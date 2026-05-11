/**
 * Product service - handles business logic for product operations.
 * Provides methods to list, get, and update cost price for products.
 */

import { prisma } from '../server';
import { NotFoundError, ValidationError } from '../utils/errors';
import { recalculateProductMargins } from './margin.service';

/**
 * Lists all products for a given store.
 * @param storeId - The store ID to filter products by
 * @returns Array of products belonging to the store
 */
export async function listProducts(storeId: string) {
  const products = await prisma.product.findMany({
    where: { storeId },
    orderBy: { title: 'asc' },
  });
  return products;
}

/**
 * Gets a single product by ID.
 * @param id - The product ID
 * @returns The product record
 * @throws NotFoundError if product is not found
 */
export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    throw new NotFoundError('Produto não encontrado');
  }

  return product;
}

/**
 * Updates the cost price of a product.
 * Validates that costPrice is greater than 0.
 * @param id - The product ID
 * @param costPrice - The new cost price (must be > 0)
 * @returns The updated product record
 * @throws NotFoundError if product is not found
 * @throws ValidationError if costPrice is not positive
 */
export async function updateCostPrice(id: string, costPrice: number) {
  if (costPrice === undefined || costPrice === null || typeof costPrice !== 'number' || isNaN(costPrice)) {
    throw new ValidationError('Preço de compra é obrigatório', [
      { field: 'costPrice', message: 'Preço de compra é obrigatório' },
    ]);
  }

  if (costPrice <= 0) {
    throw new ValidationError('Preço de compra deve ser positivo', [
      { field: 'costPrice', message: 'Preço de compra deve ser maior que zero' },
    ]);
  }

  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    throw new NotFoundError('Produto não encontrado');
  }

  await prisma.product.update({
    where: { id },
    data: { costPrice },
  });

  // Recalculate margin and ROI with the new cost price
  const updatedProduct = await recalculateProductMargins(id);

  return updatedProduct;
}
