/**
 * Dashboard service - provides consolidated sales metrics.
 * Calculates total sales, total revenue, average margin, and average ROI
 * for a given store within an optional date range.
 */

import { prisma } from '../server';

export interface DashboardMetrics {
  totalSales: number;
  totalRevenue: number;
  averageMargin: number | null;
  averageRoi: number | null;
}

/**
 * Gets consolidated dashboard metrics for a store within a date range.
 * If no date range is provided, defaults to today (start of day to now).
 *
 * @param storeId - The store ID to get metrics for
 * @param startDate - Optional start date (inclusive)
 * @param endDate - Optional end date (inclusive)
 * @returns Dashboard metrics object
 */
export async function getDashboardMetrics(
  storeId: string,
  startDate?: Date,
  endDate?: Date
): Promise<DashboardMetrics> {
  // Default to today if no date range provided
  const now = new Date();
  const effectiveStart = startDate ?? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const effectiveEnd = endDate ?? now;

  const sales = await prisma.sale.findMany({
    where: {
      storeId,
      orderDate: {
        gte: effectiveStart,
        lte: effectiveEnd,
      },
    },
    select: {
      totalAmount: true,
      margin: true,
      roi: true,
    },
  });

  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);

  // Calculate average margin (only for sales where margin is not null)
  const salesWithMargin = sales.filter((s) => s.margin !== null);
  const averageMargin =
    salesWithMargin.length > 0
      ? Math.round(
          (salesWithMargin.reduce((sum, s) => sum + s.margin!, 0) / salesWithMargin.length) * 100
        ) / 100
      : null;

  // Calculate average ROI (only for sales where roi is not null)
  const salesWithRoi = sales.filter((s) => s.roi !== null);
  const averageRoi =
    salesWithRoi.length > 0
      ? Math.round(
          (salesWithRoi.reduce((sum, s) => sum + s.roi!, 0) / salesWithRoi.length) * 100
        ) / 100
      : null;

  return {
    totalSales,
    totalRevenue,
    averageMargin,
    averageRoi,
  };
}
