import React from 'react';
import { Sale } from '../types';

export interface SalesTableProps {
  sales: Sale[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

const styles = {
  container: {
    overflowX: 'auto' as const,
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '14px',
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '10px 8px',
    borderBottom: '2px solid #e5e7eb',
    fontWeight: 600,
    color: '#374151',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: {
    padding: '10px 8px',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'middle' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  positive: {
    color: '#16a34a',
    fontWeight: 600,
  } as React.CSSProperties,
  negative: {
    color: '#dc2626',
    fontWeight: 600,
  } as React.CSSProperties,
  emptyState: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: '#6b7280',
    fontSize: '14px',
  } as React.CSSProperties,
};

export function SalesTable({ sales }: SalesTableProps) {
  if (sales.length === 0) {
    return (
      <div style={styles.emptyState}>
        <p>Nenhuma venda encontrada no período selecionado.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Data</th>
            <th style={styles.th}>Produto</th>
            <th style={styles.th}>Qtd</th>
            <th style={styles.th}>Preço Venda</th>
            <th style={styles.th}>Custo</th>
            <th style={styles.th}>Impostos</th>
            <th style={styles.th}>Taxas Amazon</th>
            <th style={styles.th}>Lucro</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => {
            const profitStyle = sale.netProfit != null
              ? (sale.netProfit >= 0 ? styles.positive : styles.negative)
              : {};

            return (
              <tr key={sale.id}>
                <td style={styles.td}>{formatDate(sale.orderDate)}</td>
                <td style={{ ...styles.td, whiteSpace: 'normal', maxWidth: '200px' }}>
                  {sale.product?.title || '—'}
                </td>
                <td style={styles.td}>{sale.quantity}</td>
                <td style={styles.td}>{formatBRL(sale.sellingPrice)}</td>
                <td style={styles.td}>
                  {sale.costPrice != null ? formatBRL(sale.costPrice) : '—'}
                </td>
                <td style={styles.td}>{formatBRL(sale.taxAmount)}</td>
                <td style={styles.td}>{formatBRL(sale.amazonFee)}</td>
                <td style={{ ...styles.td, ...profitStyle }}>
                  {sale.netProfit != null ? formatBRL(sale.netProfit) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
