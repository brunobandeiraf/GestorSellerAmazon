import React, { useState, useCallback } from 'react';
import { get } from '../services/api';
import { DashboardMetrics, Sale } from '../types';
import { MetricCard } from '../components/MetricCard';
import { SalesTable } from '../components/SalesTable';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { usePolling } from '../hooks/usePolling';

function getTodayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

const styles = {
  page: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px 24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,
  header: {
    marginBottom: '24px',
  } as React.CSSProperties,
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1a1a1a',
    margin: '0 0 4px 0',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  } as React.CSSProperties,
  metricsRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  filterSection: {
    marginBottom: '24px',
  } as React.CSSProperties,
  tableSection: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  } as React.CSSProperties,
  tableTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1a1a1a',
    marginBottom: '16px',
  } as React.CSSProperties,
  error: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '12px 16px',
    color: '#dc2626',
    fontSize: '14px',
    marginBottom: '16px',
  } as React.CSSProperties,
  pollingIndicator: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#16a34a',
    marginRight: '6px',
  } as React.CSSProperties,
  pollingText: {
    fontSize: '12px',
    color: '#6b7280',
  } as React.CSSProperties,
};

export function DashboardPage() {
  const today = getTodayString();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [metricsResponse, salesResponse] = await Promise.all([
        get<{ data: DashboardMetrics }>(`/api/dashboard?startDate=${startDate}&endDate=${endDate}`),
        get<{ data: Sale[] }>(`/api/sales?startDate=${startDate}&endDate=${endDate}`),
      ]);
      setMetrics(metricsResponse.data);
      setSales(salesResponse.data);
      setError('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados do dashboard';
      setError(message);
    }
  }, [startDate, endDate]);

  const { isPolling } = usePolling(fetchData, 60000);

  function handleFilter(newStartDate: string, newEndDate: string) {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.subtitle}>
          <span style={{
            ...styles.pollingIndicator,
            backgroundColor: isPolling ? '#16a34a' : '#9ca3af',
          }} />
          <span style={styles.pollingText}>
            {isPolling ? 'Atualizando automaticamente' : 'Atualização pausada'}
          </span>
        </p>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Metric Cards */}
      <div style={styles.metricsRow}>
        <MetricCard
          title="Total Vendas"
          value={metrics ? String(metrics.totalSales) : '0'}
        />
        <MetricCard
          title="Faturamento"
          value={metrics ? formatBRL(metrics.totalRevenue) : 'R$ 0,00'}
          color="#1a1a1a"
        />
        <MetricCard
          title="Margem Média"
          value={metrics?.averageMargin != null ? metrics.averageMargin.toFixed(1) : '—'}
          suffix="%"
          color={metrics?.averageMargin != null ? (metrics.averageMargin >= 0 ? '#16a34a' : '#dc2626') : undefined}
        />
        <MetricCard
          title="ROI Médio"
          value={metrics?.averageRoi != null ? metrics.averageRoi.toFixed(1) : '—'}
          suffix="%"
          color={metrics?.averageRoi != null ? (metrics.averageRoi >= 0 ? '#16a34a' : '#dc2626') : undefined}
        />
      </div>

      {/* Date Range Filter */}
      <div style={styles.filterSection}>
        <DateRangeFilter
          onFilter={handleFilter}
          initialStartDate={today}
          initialEndDate={today}
        />
      </div>

      {/* Sales Table */}
      <div style={styles.tableSection}>
        <div style={styles.tableTitle}>Vendas Recentes</div>
        <SalesTable sales={sales} />
      </div>
    </div>
  );
}
