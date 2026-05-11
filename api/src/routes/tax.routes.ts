/**
 * Tax routes - REST endpoints for tax configuration management.
 * GET  /api/store/tax - Returns the tax config (or null if not configured)
 * PUT  /api/store/tax - Creates or updates the tax config (upsert)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getTaxConfig, saveTaxConfig } from '../services/tax.service';

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
 * GET /api/store/tax
 * Returns the tax configuration for the store.
 * Returns null data if no tax config exists yet (but store must exist).
 */
router.get(
  '/store/tax',
  asyncHandler(async (_req: Request, res: Response) => {
    const taxConfig = await getTaxConfig();
    res.json({ data: taxConfig });
  })
);

/**
 * PUT /api/store/tax
 * Creates or updates the tax configuration for the store.
 * Validates that all rate values are between 0 and 100.
 */
router.put(
  '/store/tax',
  asyncHandler(async (req: Request, res: Response) => {
    const taxConfig = await saveTaxConfig(req.body);
    res.json({ data: taxConfig });
  })
);

export default router;
