/**
 * Dashboard routes - REST endpoint for consolidated sales metrics.
 * GET /api/dashboard - Returns dashboard metrics with optional date range filter
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { getDashboardMetrics } from '../services/dashboard.service';
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
 * GET /api/dashboard
 * Returns consolidated dashboard metrics.
 * Query params:
 *   - startDate (optional): YYYY-MM-DD format
 *   - endDate (optional): YYYY-MM-DD format
 * If no dates provided, defaults to today.
 */
router.get(
  '/dashboard',
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

    const metrics = await getDashboardMetrics(store.id, start, end);
    res.json({ data: metrics });
  })
);

export default router;
