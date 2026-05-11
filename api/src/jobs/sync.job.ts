/**
 * Sales synchronization job - automatically syncs recent sales from Amazon.
 *
 * Runs every 5 minutes via node-cron:
 * 1. Checks if an active integration exists
 * 2. Fetches orders from the last 6 hours via Orders API
 * 3. For each order, fetches line items
 * 4. Matches items to products by SKU
 * 5. Calculates financial metrics (profit, margin, ROI)
 * 6. Upserts sales by amazonOrderId to avoid duplicates
 * 7. Updates lastSyncAt on the integration record
 */

import cron from 'node-cron';
import { SellingPartner } from 'amazon-sp-api';
import { prisma } from '../server';
import { withRetry, AmazonCredentials } from '../services/amazon.service';
import {
  calculateMarginAndRoi,
  calculateTotalTaxRate,
  TaxConfigData,
} from '../services/margin.service';

/**
 * Creates a SellingPartner client from integration credentials.
 */
function createSpClient(credentials: AmazonCredentials): SellingPartner {
  return new SellingPartner({
    region: 'na',
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
 * Synchronizes recent sales from Amazon.
 * Can be called manually (for testing) or by the cron job.
 */
export async function syncRecentSales(): Promise<void> {
  // Step 1: Check if an active integration exists
  const integration = await prisma.integration.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      store: {
        include: { taxConfig: true },
      },
    },
  });

  if (!integration) {
    // No active integration, skip silently
    return;
  }

  const store = integration.store;
  const storeId = store.id;

  // Step 2: Create a SyncJob
  const syncJob = await prisma.syncJob.create({
    data: {
      type: 'SALES_RECENT',
      status: 'IN_PROGRESS',
      progress: 0,
      processedItems: 0,
    },
  });

  try {
    const credentials: AmazonCredentials = {
      clientId: integration.clientId,
      clientSecret: integration.clientSecret,
      refreshToken: integration.refreshToken,
      awsAccessKeyId: integration.awsAccessKeyId,
      awsSecretAccessKey: integration.awsSecretAccessKey,
      roleArn: integration.roleArn,
      marketplaceId: integration.marketplaceId,
    };

    const client = createSpClient(credentials);

    // Step 3: Fetch orders from the last 6 hours
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const ordersResponse = await withRetry(() =>
      client.callAPI({
        operation: 'getOrders',
        query: {
          MarketplaceIds: [credentials.marketplaceId],
          CreatedAfter: sixHoursAgo,
        } as any,
      })
    );

    const orders = (ordersResponse as any)?.Orders || (ordersResponse as any)?.payload?.Orders || [];

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

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { totalItems: orders.length },
    });

    let processedCount = 0;

    // Step 4: Process each order
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

        // Step 5: Process each order item
        for (const item of orderItems) {
          const sku = item.SellerSKU || '';
          if (!sku) continue;

          // Find matching product by SKU
          const product = await prisma.product.findFirst({
            where: { storeId, sku },
          });

          if (!product) {
            // Product not found, skip this item
            continue;
          }

          // Extract financial data from the order item
          const quantity = item.QuantityOrdered || 1;
          const sellingPrice = parseFloat(item.ItemPrice?.Amount || item.ItemPrice || '0') / quantity;
          const totalAmount = parseFloat(item.ItemPrice?.Amount || item.ItemPrice || '0');
          const amazonFee = parseFloat(
            item.ItemFee?.Amount || item.Commission?.Amount || '0'
          ) || (sellingPrice * 0.15); // Fallback to 15% if no fee data

          // Calculate tax amount using store's tax config
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
              amazonFee / quantity, // Per-unit Amazon fee
            );
            netProfit = metrics.netProfit * quantity;
            margin = metrics.margin;
            roi = metrics.roi;
          }

          // Step 6: Upsert sale by amazonOrderId (unique key)
          // We use amazonOrderId + item combination as unique identifier
          // Since amazonOrderId is unique in the Sale model, we combine orderId with item index
          const saleAmazonOrderId = orderItems.length > 1
            ? `${amazonOrderId}-${sku}`
            : amazonOrderId;

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
        }

        processedCount++;

        // Update progress
        const progress = orders.length > 0
          ? (processedCount / orders.length) * 100
          : 100;

        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            processedItems: processedCount,
            progress,
          },
        });
      } catch (orderError: any) {
        // Log individual order errors but continue processing
        console.warn(`Failed to process order ${order.AmazonOrderId}:`, orderError?.message);
        processedCount++;

        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            processedItems: processedCount,
            progress: orders.length > 0
              ? (processedCount / orders.length) * 100
              : 100,
          },
        });
      }
    }

    // Step 7: Update lastSyncAt on the integration
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date() },
    });

    // Mark SyncJob as COMPLETED
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),
      },
    });
  } catch (error: any) {
    // Mark sync as failed
    console.error('Sales sync failed:', error?.message);

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'FAILED',
        errorMessage: error?.message || 'Erro desconhecido durante sincronização de vendas',
        completedAt: new Date(),
      },
    });
  }
}

/**
 * Starts the cron job for automatic sales synchronization.
 * Runs every 5 minutes: '* /5 * * * *'
 */
export function startSyncJob(): cron.ScheduledTask {
  const task = cron.schedule('*/5 * * * *', async () => {
    try {
      await syncRecentSales();
    } catch (error: any) {
      // Never crash the server - log and continue
      console.error('Sync job error:', error?.message);
    }
  });

  console.log('Sales sync job started (every 5 minutes)');
  return task;
}
