import { useState, useCallback } from 'react';
import { get, post, put, ApiError } from '../services/api';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  fetchGet: (path: string) => Promise<T | null>;
  fetchPost: (path: string, body: unknown) => Promise<T | null>;
  fetchPut: (path: string, body: unknown) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T = unknown>(): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetchGet = useCallback(async (path: string): Promise<T | null> => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await get<T>(path);
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Erro ao carregar dados';
      setState({ data: null, loading: false, error: message });
      return null;
    }
  }, []);

  const fetchPost = useCallback(async (path: string, body: unknown): Promise<T | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await post<T>(path, body);
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Erro ao enviar dados';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      return null;
    }
  }, []);

  const fetchPut = useCallback(async (path: string, body: unknown): Promise<T | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await put<T>(path, body);
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Erro ao atualizar dados';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    fetchGet,
    fetchPost,
    fetchPut,
    reset,
  };
}
