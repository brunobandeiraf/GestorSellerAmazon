/**
 * Sale routes - REST endpoints for sales management.
 * GET /api/sales - Lists sales with optional date range filter
 * GET /api/sales/:id - Returns a single sale
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { listSales, getSale } from '../services/sale.service';
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
 * GET /api/sales
 * Lists sales for the store with optional date range filter.
 * Query params:
 *   - startDate (optional): YYYY-MM-DD format
 *   - endDate (optional): YYYY-MM-DD format
 */
router.get(
  '/sales',
  asyncHandler(async (req: Request, res: Response) => {
    // Ensure store exists
    const store = await prisma.store.findFirst();
    if (!store) {
      throw new NotFoundError('Loja não encontrada. Cadastre a loja primeiro.');
    }

    const { startDate, endDate } = req.query;

    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate && typeof startDate === 'string') {
      start = new Date(startDate + 'T00:00:00.000Z');
    }

    if (endDate && typeof endDate === 'string') {
      end = new Date(endDate + 'T23:59:59.999Z');
    }

    const sales = await listSales(store.id, start, end);
    res.json({ data: sales });
  })
);

/**
 * GET /api/sales/:id
 * Returns a single sale by ID.
 */
router.get(
  '/sales/:id',
  asyncHandler(async (req: Request, res: Response) => {
    // Ensure store exists
    const store = await prisma.store.findFirst();
    if (!store) {
      throw new NotFoundError('Loja não encontrada. Cadastre a loja primeiro.');
    }

    const id = req.params.id as string;
    const sale = await getSale(id);
    res.json({ data: sale });
  })
);

export default router;
