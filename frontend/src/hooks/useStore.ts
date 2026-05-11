import { useState, useEffect } from 'react';
import { get } from '../services/api';
import { Store } from '../types';

interface UseStoreReturn {
  store: Store | null;
  loading: boolean;
  hasStore: boolean;
}

export function useStore(): UseStoreReturn {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasStore, setHasStore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkStore() {
      try {
        const result = await get<{ data: Store | null }>('/api/store');
        if (!cancelled) {
          const storeData = (result as any)?.data ?? result;
          if (storeData && storeData.id) {
            setStore(storeData);
            setHasStore(true);
          } else {
            setStore(null);
            setHasStore(false);
          }
        }
      } catch {
        if (!cancelled) {
          setStore(null);
          setHasStore(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    checkStore();

    return () => {
      cancelled = true;
    };
  }, []);

  return { store, loading, hasStore };
}
