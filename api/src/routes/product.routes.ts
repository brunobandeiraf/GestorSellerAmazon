/**
 * Product routes - REST endpoints for product management.
 * GET  /api/products - Lists all products for the store
 * GET  /api/products/:id - Returns a single product
 * PUT  /api/products/:id/cost - Updates the cost price of a product
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { listProducts, getProduct, updateCostPrice } from '../services/product.service';
import { NotFoundError } from '../utils/errors';

const router = Router();

/**
 * Wraps an async route handler to forward errors to Express error middleware.
 */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * GET /api/products
 * Lists all products for the store.
 */
router.get(
  '/products',
  asyncHandler(async (_req: Request, res: Response) => {
    // Ensure store exists
    const store = await prisma.store.findFirst();
    if (!store) {
      throw new NotFoundError('Loja não encontrada. Cadastre a loja primeiro.');
    }

    const products = await listProducts(store.id);
    res.json({ data: products });
  })
);

/**
 * GET /api/products/:id
 * Returns a single product by ID.
 */
router.get(
  '/products/:id',
  asyncHandler(async (req: Request, res: Response) => {
    // Ensure store exists
    const store = await prisma.store.findFirst();
    if (!store) {
      throw new NotFoundError('Loja não encontrada. Cadastre a loja primeiro.');
    }

    const id = req.params.id as string;
    const product = await getProduct(id);
    res.json({ data: product });
  })
);

/**
 * PUT /api/products/:id/cost
 * Updates the cost price of a product.
 * Validates that costPrice > 0.
 */
router.put(
  '/products/:id/cost',
  asyncHandler(async (req: Request, res: Response) => {
    // Ensure store exists
    const store = await prisma.store.findFirst();
    if (!store) {
      throw new NotFoundError('Loja não encontrada. Cadastre a loja primeiro.');
    }

    const id = req.params.id as string;
    const { costPrice } = req.body;
    const product = await updateCostPrice(id, costPrice);
    res.json({ data: product });
  })
);

export default router;
