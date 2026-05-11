/**
 * Shared TypeScript types for the Amazon Sales Manager API.
 */

// Re-export Prisma enums for convenience
export { TaxRegime, IntegrationStatus, ProductStatus, SyncType, SyncStatus } from '@prisma/client';

/** Standard API error response format */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

/** Pagination parameters for list endpoints */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/** Date range filter for sales/dashboard queries */
export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}

/** Store creation/update payload */
export interface StoreInput {
  name: string;
  cnpj: string;
  taxRegime: string;
}

/** Tax configuration payload */
export interface TaxConfigInput {
  icms?: number;
  pis?: number;
  cofins?: number;
  irpj?: number;
  csll?: number;
  dasRate?: number;
}

/** Integration credentials payload */
export interface IntegrationInput {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  roleArn: string;
  marketplaceId?: string;
}

/** Cost price update payload */
export interface CostPriceInput {
  costPrice: number;
}

/** Dashboard metrics response */
export interface DashboardMetrics {
  totalSales: number;
  totalRevenue: number;
  averageMargin: number | null;
  averageRoi: number | null;
}

/** Sync progress response */
export interface SyncProgress {
  id: string;
  type: string;
  status: string;
  progress: number;
  totalItems: number | null;
  processedItems: number | null;
  errorMessage: string | null;
}
