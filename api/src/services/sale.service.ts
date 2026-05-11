/**
 * Sale service - handles business logic for sale operations.
 * Provides methods to list sales with date filtering and get individual sales.
 */

import { prisma } from '../server';
import { NotFoundError } from '../utils/errors';

/**
 * Lists sales for a given store with optional date range filter.
 * Includes product relation (title, sku, imageUrl).
 * Orders by orderDate descending.
 *
 * @param storeId - The store ID to filter sales by
 * @param startDate - Optional start date (inclusive)
 * @param endDate - Optional end date (inclusive)
 * @returns Array of sales with product info
 */
export async function listSales(storeId: string, startDate?: Date, endDate?: Date) {
  const where: Record<string, unknown> = { storeId };

  if (startDate || endDate) {
    const orderDateFilter: Record<string, Date> = {};
    if (startDate) {
      orderDateFilter.gte = startDate;
    }
    if (endDate) {
      orderDateFilter.lte = endDate;
    }
    where.orderDate = orderDateFilter;
  }

  const sales = await prisma.sale.findMany({
    where,
    include: {
      product: {
        select: {
          title: true,
          sku: true,
          imageUrl: true,
        },
      },
    },
    orderBy: { orderDate: 'desc' },
  });

  return sales;
}

/**
 * Gets a single sale by ID with product info.
 *
 * @param id - The sale ID
 * @returns The sale record with product info
 * @throws NotFoundError if sale is not found
 */
export async function getSale(id: string) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      product: {
        select: {
          title: true,
          sku: true,
          imageUrl: true,
        },
      },
    },
  });

  if (!sale) {
    throw new NotFoundError('Venda não encontrada');
  }

  return sale;
}
