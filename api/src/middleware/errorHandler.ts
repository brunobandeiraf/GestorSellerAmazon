import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ApiErrorResponse } from '../types';

/**
 * Global error handling middleware.
 * Catches all errors thrown in route handlers and services,
 * returning a standardized JSON error response.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Unexpected errors
  console.error('Unhandled error:', err);

  const response: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };
  res.status(500).json(response);
}
