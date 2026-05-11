/**
 * Margin service - handles margin and ROI calculations.
 *
 * Pure calculation functions for easy testing, plus DB-aware functions
 * for recalculating product margins when tax config or cost prices change.
 *
 * Formulas:
 *   impostos = preço_venda × (alíquota_total / 100)
 *   taxas_amazon = amazonFee field on product (or 15% of selling price as fallback)
 *   margem = ((preço_venda - preço_compra - impostos - taxas_amazon) / preço_venda) × 100
 *   roi = ((preço_venda - preço_compra - impostos - taxas_amazon) / preço_compra) × 100
 *   lucro_líquido = preço_venda - preço_compra - impostos - taxas_amazon
 *
 * Alíquota total by regime:
 *   MEI → dasRate
 *   SIMPLES_NACIONAL → dasRate
 *   LUCRO_PRESUMIDO → icms + pis + cofins + irpj + csll
 */

import { TaxRegime } from '@prisma/client';
import { prisma } from '../server';

/** Result of margin/ROI calculation */
export interface MarginResult {
  margin: number;
  roi: number;
  netProfit: number;
}

/** Tax config shape used for calculation */
export interface TaxConfigData {
  icms: number;
  pis: number;
  cofins: number;
  irpj: number;
  csll: number;
  dasRate: number;
}

/**
 * Calculates the total tax rate percentage based on the tax regime.
 *
 * - MEI / SIMPLES_NACIONAL → dasRate (single DAS rate)
 * - LUCRO_PRESUMIDO → icms + pis + cofins + irpj + csll
 *
 * @param taxConfig - The tax configuration with individual rates
 * @param taxRegime - The store's tax regime
 * @returns The total tax rate as a percentage (0-100)
 */
export function calculateTotalTaxRate(
  taxConfig: TaxConfigData,
  taxRegime: TaxRegime,
): number {
  if (taxRegime === TaxRegime.MEI || taxRegime === TaxRegime.SIMPLES_NACIONAL) {
    return taxConfig.dasRate;
  }

  // LUCRO_PRESUMIDO: sum of individual rates
  return taxConfig.icms + taxConfig.pis + taxConfig.cofins + taxConfig.irpj + taxConfig.csll;
}

/**
 * Calculates margin, ROI, and net profit for a product.
 *
 * This is a pure function with no side effects — ideal for testing.
 *
 * @param sellingPrice - The product's selling price (must be > 0)
 * @param costPrice - The product's cost/purchase price (must be > 0)
 * @param taxRate - The total tax rate percentage (0-100)
 * @param amazonFee - The Amazon fee amount in currency (absolute value, not percentage)
 * @returns Object with margin (%), roi (%), and netProfit (currency)
 */
export function calculateMarginAndRoi(
  sellingPrice: number,
  costPrice: number,
  taxRate: number,
  amazonFee: number,
): MarginResult {
  const taxAmount = sellingPrice * (taxRate / 100);
  const netProfit = sellingPrice - costPrice - taxAmount - amazonFee;

  const margin = (netProfit / sellingPrice) * 100;
  const roi = (netProfit / costPrice) * 100;

  return {
    margin: Math.round(margin * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
  };
}

/**
 * Recalculates margin and ROI for a single product.
 *
 * Fetches the store's tax config from the database, computes the total tax rate,
 * determines the Amazon fee (uses product.amazonFee or 15% fallback),
 * and updates the product record with new margin/ROI values.
 *
 * @param productId - The product ID to recalculate
 * @returns The updated product record, or null if costPrice is not set
 */
export async function recalculateProductMargins(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      store: {
        include: { taxConfig: true },
      },
    },
  });

  if (!product) {
    return null;
  }

  // Cannot calculate without costPrice
  if (product.costPrice === null || product.costPrice === undefined) {
    return product;
  }

  const store = product.store;
  const taxConfig = store.taxConfig;

  // Default to 0% tax rate if no tax config exists
  let taxRate = 0;
  if (taxConfig) {
    taxRate = calculateTotalTaxRate(taxConfig, store.taxRegime);
  }

  // Use product's amazonFee or fallback to 15% of selling price
  const amazonFee = product.amazonFee ?? product.sellingPrice * 0.15;

  const { margin, roi } = calculateMarginAndRoi(
    product.sellingPrice,
    product.costPrice,
    taxRate,
    amazonFee,
  );

  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: { margin, roi },
  });

  return updatedProduct;
}

/**
 * Recalculates margin and ROI for all products in a store that have costPrice set.
 *
 * Typically called when the tax configuration is updated, so all product margins
 * reflect the new tax rates.
 *
 * @param storeId - The store ID whose products should be recalculated
 * @returns The number of products updated
 */
export async function recalculateAllProductMargins(storeId: string): Promise<number> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { taxConfig: true },
  });

  if (!store) {
    return 0;
  }

  // Get all products with costPrice set
  const products = await prisma.product.findMany({
    where: {
      storeId,
      costPrice: { not: null },
    },
  });

  if (products.length === 0) {
    return 0;
  }

  // Calculate tax rate once (same for all products in the store)
  let taxRate = 0;
  if (store.taxConfig) {
    taxRate = calculateTotalTaxRate(store.taxConfig, store.taxRegime);
  }

  let updatedCount = 0;

  for (const product of products) {
    const amazonFee = product.amazonFee ?? product.sellingPrice * 0.15;

    const { margin, roi } = calculateMarginAndRoi(
      product.sellingPrice,
      product.costPrice!,
      taxRate,
      amazonFee,
    );

    await prisma.product.update({
      where: { id: product.id },
      data: { margin, roi },
    });

    updatedCount++;
  }

  return updatedCount;
}
