/**
 * HTTP client wrapper with configurable base URL.
 * Uses VITE_API_URL env variable or defaults to '' (Vite proxy handles /api).
 */

import { ApiErrorResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  public code: string;
  public details?: Array<{ field: string; message: string }>;
  public statusCode: number;

  constructor(statusCode: number, errorResponse: ApiErrorResponse['error']) {
    super(errorResponse.message);
    this.name = 'ApiError';
    this.code = errorResponse.code;
    this.details = errorResponse.details;
    this.statusCode = statusCode;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorBody: ApiErrorResponse;
    try {
      errorBody = await response.json();
    } catch {
      throw new ApiError(response.status, {
        code: 'UNKNOWN_ERROR',
        message: `Request failed with status ${response.status}`,
      });
    }
    throw new ApiError(response.status, errorBody.error);
  }
  return response.json() as Promise<T>;
}

export async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  return handleResponse<T>(response);
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function put<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}
