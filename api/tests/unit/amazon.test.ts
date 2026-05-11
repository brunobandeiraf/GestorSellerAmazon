/**
 * Unit tests for amazon.service.ts
 * Tests the withRetry helper, parseListingsReport logic, and service behavior.
 */

import { withRetry } from '../../src/services/amazon.service';

// Mock the prisma client
jest.mock('../../src/server', () => ({
  prisma: {
    syncJob: {
      create: jest.fn(),
      update: jest.fn(),
    },
    product: {
      upsert: jest.fn(),
    },
  },
}));

// Mock amazon-sp-api
jest.mock('amazon-sp-api', () => ({
  SellingPartner: jest.fn().mockImplementation(() => ({
    callAPI: jest.fn(),
    download: jest.fn(),
  })),
}));

describe('amazon.service', () => {
  describe('withRetry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return result on first successful call', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 rate limit error', async () => {
      const rateLimitError = { statusCode: 429, message: 'Too Many Requests' };
      const fn = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');

      const promise = withRetry(fn);

      // Advance timers to handle the sleep(1000) backoff
      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry up to maxRetries times on rate limit', async () => {
      jest.useRealTimers();

      const rateLimitError = { statusCode: 429, message: 'Too Many Requests' };
      const fn = jest.fn().mockRejectedValue(rateLimitError);

      // Use maxRetries=0 to avoid long waits in test
      await expect(withRetry(fn, 0)).rejects.toEqual(rateLimitError);
      expect(fn).toHaveBeenCalledTimes(1);

      // Now test with maxRetries=1 (short backoff)
      fn.mockClear();
      await expect(withRetry(fn, 1)).rejects.toEqual(rateLimitError);
      expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
    });

    it('should not retry on non-rate-limit errors', async () => {
      const otherError = { statusCode: 500, message: 'Internal Server Error' };
      const fn = jest.fn().mockRejectedValue(otherError);

      await expect(withRetry(fn)).rejects.toEqual(otherError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on throttle-related error messages', async () => {
      const throttleError = { message: 'Request was throttled' };
      const fn = jest.fn()
        .mockRejectedValueOnce(throttleError)
        .mockResolvedValueOnce('ok');

      const promise = withRetry(fn);
      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on QuotaExceeded error code', async () => {
      const quotaError = { code: 'QuotaExceeded', message: 'Quota exceeded' };
      const fn = jest.fn()
        .mockRejectedValueOnce(quotaError)
        .mockResolvedValueOnce('recovered');

      const promise = withRetry(fn);
      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff delays (1s, 2s, 4s)', async () => {
      const rateLimitError = { statusCode: 429, message: 'Rate limit' };
      const fn = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('finally');

      const promise = withRetry(fn, 3);

      // After 999ms, should not have retried yet
      await jest.advanceTimersByTimeAsync(999);
      expect(fn).toHaveBeenCalledTimes(1);

      // After 1ms more (total 1000ms), first retry
      await jest.advanceTimersByTimeAsync(1);
      expect(fn).toHaveBeenCalledTimes(2);

      // After 2000ms more, second retry
      await jest.advanceTimersByTimeAsync(2000);
      expect(fn).toHaveBeenCalledTimes(3);

      // After 4000ms more, third retry
      await jest.advanceTimersByTimeAsync(4000);
      expect(fn).toHaveBeenCalledTimes(4);

      const result = await promise;
      expect(result).toBe('finally');
    });
  });
});
