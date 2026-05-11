import React, { useState, useEffect, useCallback } from 'react';
import { get } from '../services/api';
import { Sale } from '../types';
import { SalesTable } from '../components/SalesTable';
import { DateRangeFilter } from '../components/DateRangeFilter';

function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return getDateString(date);
}

function getDefaultEndDate(): string {
  return getDateString(new Date());
}

const styles = {
  page: {
    maxWidth: '1100px',
  } as React.CSSProperties,
  header: {
    marginBottom: '24px',
  } as React.CSSProperties,
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 8px',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  } as React.CSSProperties,
  filterRow: {
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '12px',
  } as React.CSSProperties,
  count: {
    fontSize: '14px',
    color: '#374151',
    fontWeight: 500,
  } as React.CSSProperties,
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '20px',
  } as React.CSSProperties,
  loading: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#6b7280',
  } as React.CSSProperties,
  error: {
    padding: '16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#dc2626',
    fontSize: '14px',
  } as React.CSSProperties,
};

export function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const defaultStart = getDefaultStartDate();
  const defaultEnd = getDefaultEndDate();

  const fetchSales = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await get<{ data: Sale[]; total?: number }>(
        `/api/sales?startDate=${startDate}&endDate=${endDate}`
      );
      const salesData = (result as any)?.data ?? result;
      const list = Array.isArray(salesData) ? salesData : [];
      setSales(list);
      setTotalCount((result as any)?.total ?? list.length);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar vendas');
      setSales([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSales(defaultStart, defaultEnd);
  }, [fetchSales, defaultStart, defaultEnd]);

  function handleFilter(startDate: string, endDate: string) {
    fetchSales(startDate, endDate);
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Histórico de Vendas</h1>
        <p style={styles.subtitle}>Visualize todas as vendas realizadas no período selecionado.</p>
      </div>

      <div style={styles.filterRow}>
        <DateRangeFilter
          onFilter={handleFilter}
          initialStartDate={defaultStart}
          initialEndDate={defaultEnd}
        />
        <span style={styles.count}>
          {totalCount} venda{totalCount !== 1 ? 's' : ''} no período
        </span>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.card}>
        {loading ? (
          <div style={styles.loading}>Carregando vendas...</div>
        ) : (
          <SalesTable sales={sales} />
        )}
      </div>
    </div>
  );
}
