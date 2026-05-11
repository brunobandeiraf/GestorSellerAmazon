/**
 * Store routes - REST endpoints for store management.
 * GET  /api/store - Returns the store or null
 * POST /api/store - Creates a new store (409 if already exists)
 * PUT  /api/store - Updates the existing store (404 if doesn't exist)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createStore, getStore, updateStore } from '../services/store.service';

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
 * GET /api/store
 * Returns the store data or null if no store exists.
 */
router.get(
  '/store',
  asyncHandler(async (_req: Request, res: Response) => {
    const store = await getStore();
    res.json({ data: store });
  })
);

/**
 * POST /api/store
 * Creates a new store. Returns 409 if a store already exists.
 */
router.post(
  '/store',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await createStore(req.body);
    res.status(201).json({ data: store });
  })
);

/**
 * PUT /api/store
 * Updates the existing store. Returns 404 if no store exists.
 */
router.put(
  '/store',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await updateStore(req.body);
    res.json({ data: store });
  })
);

export default router;
