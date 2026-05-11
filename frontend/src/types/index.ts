/**
 * Shared frontend TypeScript types for the Amazon Sales Manager.
 */

/** Tax regime options */
export type TaxRegime = 'MEI' | 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO';

/** Store creation/update payload */
export interface StoreInput {
  name: string;
  cnpj: string;
  taxRegime: TaxRegime;
}

/** Store data returned from API */
export interface Store {
  id: string;
  name: string;
  cnpj: string;
  taxRegime: TaxRegime;
  createdAt: string;
  updatedAt: string;
}

/** Standard API error response format */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

/** Standard API success response */
export interface ApiResponse<T> {
  data: T;
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

/** Tax configuration data */
export interface TaxConfig {
  id: string;
  storeId: string;
  icms: number;
  pis: number;
  cofins: number;
  irpj: number;
  csll: number;
  dasRate: number;
  createdAt: string;
  updatedAt: string;
}

/** Field validation error */
export interface FieldError {
  field: string;
  message: string;
}

/** Integration credentials input */
export interface IntegrationInput {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  roleArn: string;
}

/** Integration status from API */
export type IntegrationStatus = 'PENDING' | 'ACTIVE' | 'ERROR';

/** Integration data returned from API */
export interface Integration {
  id: string;
  storeId: string;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Product status */
export type ProductStatus = 'ACTIVE' | 'INACTIVE';

/** Product data returned from API */
export interface Product {
  id: string;
  sku: string;
  asin: string;
  title: string;
  imageUrl: string | null;
  sellingPrice: number;
  costPrice: number | null;
  status: ProductStatus;
  margin: number | null;
  roi: number | null;
  amazonFee: number | null;
}

/** Sync progress data */
export interface SyncProgress {
  id: string;
  type: 'PRODUCTS' | 'SALES_HISTORY' | 'SALES_RECENT';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  progress: number;
  totalItems: number | null;
  processedItems: number | null;
  errorMessage: string | null;
}

/** Sale data returned from API */
export interface Sale {
  id: string;
  storeId: string;
  productId: string;
  product?: Product;
  amazonOrderId: string;
  orderDate: string;
  quantity: number;
  sellingPrice: number;
  totalAmount: number;
  amazonFee: number;
  taxAmount: number;
  costPrice: number | null;
  netProfit: number | null;
  margin: number | null;
  roi: number | null;
  orderStatus: string;
  createdAt: string;
  updatedAt: string;
}

/** Dashboard consolidated metrics */
export interface DashboardMetrics {
  totalSales: number;
  totalRevenue: number;
  averageMargin: number | null;
  averageRoi: number | null;
}
