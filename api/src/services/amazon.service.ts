/**
 * Amazon SP-API service - handles integration with Amazon Selling Partner API.
 * Provides methods for testing connection, importing products, and fetching images.
 */

import { SellingPartner } from 'amazon-sp-api';
import { prisma } from '../server';
import { IntegrationError } from '../utils/errors';
import { ProductStatus } from '@prisma/client';
import {
  calculateMarginAndRoi,
  calculateTotalTaxRate,
  TaxConfigData,
} from './margin.service';

/** Credentials required to connect to Amazon SP-API */
export interface AmazonCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  roleArn: string;
  marketplaceId: string;
}

/** Parsed product data from the merchant listings report */
interface ReportProduct {
  sku: string;
  asin: string;
  title: string;
  price: number;
  status: string;
}

/**
 * Retry helper with exponential backoff for rate-limited requests.
 * Retries on 429 (Too Many Requests) errors up to maxRetries times.
 * Delays: 1s, 2s, 4s (exponential backoff).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const isRateLimit =
        error?.statusCode === 429 ||
        error?.code === 'QuotaExceeded' ||
        error?.message?.includes('429') ||
        error?.message?.toLowerCase()?.includes('rate') ||
        error?.message?.toLowerCase()?.includes('throttl');

      if (!isRateLimit || attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt) * 1000;
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/** Sleep utility for backoff delays */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a SellingPartner client instance from credentials.
 */
function createSpClient(credentials: AmazonCredentials): SellingPartner {
  return new SellingPartner({
    region: 'na', // Brazil is in the NA region for SP-API
    refresh_token: credentials.refreshToken,
    credentials: {
      SELLING_PARTNER_APP_CLIENT_ID: credentials.clientId,
      SELLING_PARTNER_APP_CLIENT_SECRET: credentials.clientSecret,
    },
    options: {
      auto_request_tokens: true,
      auto_request_throttled: true,
    },
  });
}

/**
 * Tests the connection to Amazon SP-API by making a simple API call.
 * @throws IntegrationError if the connection fails
 */
export async function testConnection(credentials: AmazonCredentials): Promise<boolean> {
  try {
    const client = createSpClient(credentials);

    // Try to get orders as a simple connectivity test
    await withRetry(() =>
      client.callAPI({
        operation: 'getOrders',
        query: {
          MarketplaceIds: [credentials.marketplaceId],
          CreatedAfter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          MaxResultsPerPage: 1,
        } as any,
      })
    );

    return true;
  } catch (error: any) {
    const message = error?.message || 'Falha ao conectar com a Amazon SP-API';
    throw new IntegrationError(`Erro de conexão com Amazon: ${message}`);
  }
}

/**
 * Fetches the product image URL from the Catalog Items API.
 * Returns null if no image is found.
 */
export async function getProductImage(
  credentials: AmazonCredentials,
  asin: string
): Promise<string | null> {
  try {
    const client = createSpClient(credentials);

    const response = await withRetry(() =>
      client.callAPI({
        operation: 'getCatalogItem',
        path: { asin },
        query: {
          marketplaceIds: [credentials.marketplaceId],
          includedData: 'images',
        } as any,
      })
    );

    // Extract image URL from response
    const images = (response as any)?.images;
    if (images && Array.isArray(images)) {
      for (const imageSet of images) {
        const imageList = imageSet?.images;
        if (imageList && Array.isArray(imageList) && imageList.length > 0) {
          // Prefer MAIN variant
          const mainImage = imageList.find((img: any) => img.variant === 'MAIN');
          return mainImage?.link || imageList[0]?.link || null;
        }
      }
    }

    // Fallback: check payload structure (older API versions)
    const payload = (response as any)?.payload;
    if (payload?.AttributeSets?.[0]?.SmallImage?.URL) {
      return payload.AttributeSets[0].SmallImage.URL;
    }

    return null;
  } catch (error: any) {
    // Image fetch failure is non-critical, return null
    console.warn(`Failed to fetch image for ASIN ${asin}:`, error?.message);
    return null;
  }
}

/**
 * Imports all products from Amazon via the Reports API.
 * 1. Creates a SyncJob with type PRODUCTS
 * 2. Requests a GET_MERCHANT_LISTINGS_ALL_DATA report
 * 3. Polls until the report is ready
 * 4. Downloads and parses the report
 * 5. For each product, fetches image via Catalog Items API
 * 6. Upserts products in the database (storeId + sku as unique key)
 * 7. Updates SyncJob progress as products are processed
 *
 * @param credentials - Amazon SP-API credentials
 * @param storeId - The store ID to associate products with
 * @returns The SyncJob record
 */
export async function importProducts(
  credentials: AmazonCredentials,
  storeId: string
) {
  // Create SyncJob
  const syncJob = await prisma.syncJob.create({
    data: {
      type: 'PRODUCTS',
      status: 'IN_PROGRESS',
      progress: 0,
      processedItems: 0,
    },
  });

  try {
    const client = createSpClient(credentials);

    // Step 1: Create report request
    const createReportResponse = await withRetry(() =>
      client.callAPI({
        operation: 'createReport',
        body: {
          reportType: 'GET_MERCHANT_LISTINGS_ALL_DATA',
          marketplaceIds: [credentials.marketplaceId],
        },
      })
    );

    const reportId = (createReportResponse as any)?.reportId;
    if (!reportId) {
      throw new IntegrationError('Falha ao criar relatório de produtos na Amazon');
    }

    // Step 2: Poll for report completion
    let reportDocumentId: string | null = null;
    const maxPollAttempts = 30;
    const pollIntervalMs = 10000; // 10 seconds

    for (let i = 0; i < maxPollAttempts; i++) {
      const reportStatus = await withRetry(() =>
        client.callAPI({
          operation: 'getReport',
          path: { reportId },
        })
      );

      const status = (reportStatus as any)?.processingStatus || (reportStatus as any)?.payload?.processingStatus;

      if (status === 'DONE') {
        reportDocumentId = (reportStatus as any)?.reportDocumentId || (reportStatus as any)?.payload?.reportDocumentId;
        break;
      }

      if (status === 'CANCELLED' || status === 'FATAL') {
        throw new IntegrationError(`Relatório de produtos falhou com status: ${status}`);
      }

      // Wait before polling again
      await sleep(pollIntervalMs);
    }

    if (!reportDocumentId) {
      throw new IntegrationError('Timeout aguardando relatório de produtos da Amazon');
    }

    // Step 3: Get report document URL
    const reportDocResponse = await withRetry(() =>
      client.callAPI({
        operation: 'getReportDocument',
        path: { reportDocumentId },
      })
    );

    // Step 4: Download and parse the report
    const reportData = await client.download(
      (reportDocResponse as any)?.payload || reportDocResponse,
      { json: true }
    );

    const products = parseListingsReport(reportData as any);

    // Update total items
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { totalItems: products.length },
    });

    // Step 5: Process each product
    let processedCount = 0;

    for (const product of products) {
      try {
        // Fetch image for this product
        const imageUrl = await getProductImage(credentials, product.asin);

        // Upsert product (storeId + sku as unique key)
        await prisma.product.upsert({
          where: {
            storeId_sku: {
              storeId,
              sku: product.sku,
            },
          },
          create: {
            storeId,
            sku: product.sku,
            asin: product.asin,
            title: product.title,
            sellingPrice: product.price,
            imageUrl,
            status: mapProductStatus(product.status),
          },
          update: {
            asin: product.asin,
            title: product.title,
            sellingPrice: product.price,
            imageUrl: imageUrl || undefined,
            status: mapProductStatus(product.status),
          },
        });

        processedCount++;

        // Update progress
        const progress = products.length > 0
          ? (processedCount / products.length) * 100
          : 100;

        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            processedItems: processedCount,
            progress,
          },
        });
      } catch (productError: any) {
        // Log individual product errors but continue processing
        console.warn(`Failed to process product ${product.sku}:`, productError?.message);
        processedCount++;

        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            processedItems: processedCount,
            progress: products.length > 0
              ? (processedCount / products.length) * 100
              : 100,
          },
        });
      }
    }

    // Mark sync as completed
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),
      },
    });

    return syncJob;
  } catch (error: any) {
    // Mark sync as failed
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'FAILED',
        errorMessage: error?.message || 'Erro desconhecido durante importação de produtos',
        completedAt: new Date(),
      },
    });

    throw new IntegrationError(
      error?.message || 'Falha ao importar produtos da Amazon'
    );
  }
}

/**
 * Parses the GET_MERCHANT_LISTINGS_ALL_DATA report into product objects.
 * The report is a TSV (tab-separated values) file with headers.
 */
function parseListingsReport(data: any): ReportProduct[] {
  if (!data || !Array.isArray(data)) {
    return [];
  }

  const products: ReportProduct[] = [];

  for (const row of data) {
    // The report columns vary but typically include:
    // seller-sku, asin1, item-name, price, status
    const sku = row['seller-sku'] || row['sku'] || row['Seller SKU'] || '';
    const asin = row['asin1'] || row['asin'] || row['ASIN'] || '';
    const title = row['item-name'] || row['title'] || row['Title'] || row['Product Name'] || '';
    const priceStr = row['price'] || row['Price'] || row['your-price'] || '0';
    const status = row['status'] || row['Status'] || row['listing-status'] || 'Active';

    if (sku && asin) {
      products.push({
        sku: sku.trim(),
        asin: asin.trim(),
        title: title.trim() || `Product ${sku}`,
        price: parseFloat(priceStr) || 0,
        status: status.trim(),
      });
    }
  }

  return products;
}

/**
 * Maps Amazon listing status to our ProductStatus enum.
 */
function mapProductStatus(amazonStatus: string): ProductStatus {
  const normalizedStatus = amazonStatus.toLowerCase().trim();

  if (
    normalizedStatus === 'active' ||
    normalizedStatus === 'open' ||
    normalizedStatus === 'buyable'
  ) {
    return 'ACTIVE';
  }

  return 'INACTIVE';
}

/** Represents a failed batch period during historical import */
interface FailedBatch {
  startDate: string;
  endDate: string;
  error: string;
}

/**
 * Imports historical sales in 30-day batches via Orders API with pagination.
 *
 * 1. Creates a SyncJob with type SALES_HISTORY
 * 2. Determines date range: from 1 year ago to now
 * 3. Splits into 30-day batches
 * 4. For each batch, calls getOrders with CreatedAfter/CreatedBefore
 * 5. Processes orders (match by SKU, calculate metrics)
 * 6. Updates progress after each batch
 * 7. If a batch fails, records it and continues with next batch
 * 8. At the end, if any batches failed, marks as PARTIAL with error details
 * 9. Otherwise marks as COMPLETED
 *
 * @param credentials - Amazon SP-API credentials
 * @param storeId - The store ID to associate sales with
 * @returns The SyncJob record
 */
export async function importHistoricalSales(
  credentials: AmazonCredentials,
  storeId: string
) {
  // Create SyncJob
  const syncJob = await prisma.syncJob.create({
    data: {
      type: 'SALES_HISTORY',
      status: 'IN_PROGRESS',
      progress: 0,
      processedItems: 0,
    },
  });

  try {
    const client = createSpClient(credentials);

    // Load store with tax config for financial calculations
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { taxConfig: true },
    });

    if (!store) {
      throw new IntegrationError('Loja não encontrada');
    }

    // Calculate tax rate for the store
    let taxRate = 0;
    if (store.taxConfig) {
      const taxConfigData: TaxConfigData = {
        icms: store.taxConfig.icms,
        pis: store.taxConfig.pis,
        cofins: store.taxConfig.cofins,
        irpj: store.taxConfig.irpj,
        csll: store.taxConfig.csll,
        dasRate: store.taxConfig.dasRate,
      };
      taxRate = calculateTotalTaxRate(taxConfigData, store.taxRegime);
    }

    // Determine date range: 1 year ago to now
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    // Split into 30-day batches
    const batches: Array<{ start: Date; end: Date }> = [];
    let batchStart = new Date(startDate);
    while (batchStart < endDate) {
      const batchEnd = new Date(batchStart);
      batchEnd.setDate(batchEnd.getDate() + 30);
      if (batchEnd > endDate) {
        batchEnd.setTime(endDate.getTime());
      }
      batches.push({ start: new Date(batchStart), end: new Date(batchEnd) });
      batchStart = new Date(batchEnd);
    }

    const totalBatches = batches.length;
    const failedBatches: FailedBatch[] = [];
    let totalProcessedOrders = 0;

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { totalItems: totalBatches },
    });

    // Process each batch
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batch = batches[batchIndex];

      try {
        // Fetch orders for this batch with pagination
        let nextToken: string | null = null;

        do {
          const query: any = {
            MarketplaceIds: [credentials.marketplaceId],
            CreatedAfter: batch.start.toISOString(),
            CreatedBefore: batch.end.toISOString(),
          };

          if (nextToken) {
            query.NextToken = nextToken;
          }

          const ordersResponse = await withRetry(() =>
            client.callAPI({
              operation: 'getOrders',
              query,
            })
          );

          const orders =
            (ordersResponse as any)?.Orders ||
            (ordersResponse as any)?.payload?.Orders ||
            [];
          nextToken =
            (ordersResponse as any)?.NextToken ||
            (ordersResponse as any)?.payload?.NextToken ||
            null;

          // Process each order in this page
          for (const order of orders) {
            try {
              const amazonOrderId = order.AmazonOrderId;
              const orderDate = new Date(order.PurchaseDate || order.CreatedDate || new Date());
              const orderStatus = order.OrderStatus || 'Unknown';

              // Fetch order items
              const itemsResponse = await withRetry(() =>
                client.callAPI({
                  operation: 'getOrderItems',
                  path: { orderId: amazonOrderId },
                })
              );

              const orderItems =
                (itemsResponse as any)?.OrderItems ||
                (itemsResponse as any)?.payload?.OrderItems ||
                [];

              // Process each order item
              for (const item of orderItems) {
                const sku = item.SellerSKU || '';
                if (!sku) continue;

                // Find matching product by SKU
                const product = await prisma.product.findFirst({
                  where: { storeId, sku },
                });

                if (!product) continue;

                // Extract financial data
                const quantity = item.QuantityOrdered || 1;
                const sellingPrice =
                  parseFloat(item.ItemPrice?.Amount || item.ItemPrice || '0') / quantity;
                const totalAmount = parseFloat(item.ItemPrice?.Amount || item.ItemPrice || '0');
                const amazonFee =
                  parseFloat(item.ItemFee?.Amount || item.Commission?.Amount || '0') ||
                  sellingPrice * 0.15;

                // Calculate tax amount
                const taxAmount = totalAmount * (taxRate / 100);

                // Use product's current costPrice
                const costPrice = product.costPrice ?? null;

                // Calculate financial metrics if costPrice is available
                let netProfit: number | null = null;
                let margin: number | null = null;
                let roi: number | null = null;

                if (costPrice !== null && costPrice > 0) {
                  const metrics = calculateMarginAndRoi(
                    sellingPrice,
                    costPrice,
                    taxRate,
                    amazonFee / quantity
                  );
                  netProfit = metrics.netProfit * quantity;
                  margin = metrics.margin;
                  roi = metrics.roi;
                }

                // Upsert sale by amazonOrderId
                const saleAmazonOrderId =
                  orderItems.length > 1 ? `${amazonOrderId}-${sku}` : amazonOrderId;

                await prisma.sale.upsert({
                  where: { amazonOrderId: saleAmazonOrderId },
                  create: {
                    storeId,
                    productId: product.id,
                    amazonOrderId: saleAmazonOrderId,
                    orderDate,
                    quantity,
                    sellingPrice,
                    totalAmount,
                    amazonFee,
                    taxAmount,
                    costPrice,
                    netProfit,
                    margin,
                    roi,
                    orderStatus,
                  },
                  update: {
                    orderDate,
                    quantity,
                    sellingPrice,
                    totalAmount,
                    amazonFee,
                    taxAmount,
                    costPrice,
                    netProfit,
                    margin,
                    roi,
                    orderStatus,
                  },
                });

                totalProcessedOrders++;
              }
            } catch (orderError: any) {
              // Log individual order errors but continue
              console.warn(
                `Failed to process historical order ${order.AmazonOrderId}:`,
                orderError?.message
              );
            }
          }
        } while (nextToken);
      } catch (batchError: any) {
        // Record failed batch and continue with next
        failedBatches.push({
          startDate: batch.start.toISOString(),
          endDate: batch.end.toISOString(),
          error: batchError?.message || 'Erro desconhecido',
        });
        console.warn(
          `Batch failed (${batch.start.toISOString()} - ${batch.end.toISOString()}):`,
          batchError?.message
        );
      }

      // Update progress after each batch
      const progress = ((batchIndex + 1) / totalBatches) * 100;
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          processedItems: batchIndex + 1,
          progress,
        },
      });
    }

    // Determine final status
    if (failedBatches.length > 0) {
      // Partial success - some batches failed
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'PARTIAL',
          progress: 100,
          completedAt: new Date(),
          errorMessage: JSON.stringify({
            message: `${failedBatches.length} de ${totalBatches} períodos falharam`,
            failedBatches,
            totalImported: totalProcessedOrders,
          }),
        },
      });
    } else {
      // All batches succeeded
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          completedAt: new Date(),
          errorMessage: totalProcessedOrders > 0
            ? JSON.stringify({ totalImported: totalProcessedOrders })
            : null,
        },
      });
    }

    return syncJob;
  } catch (error: any) {
    // Mark sync as failed
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'FAILED',
        errorMessage: error?.message || 'Erro desconhecido durante importação de vendas históricas',
        completedAt: new Date(),
      },
    });

    throw new IntegrationError(
      error?.message || 'Falha ao importar vendas históricas da Amazon'
    );
  }
}
