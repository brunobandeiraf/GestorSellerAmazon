import React from 'react';

export interface MetricCardProps {
  /** Title of the metric */
  title: string;
  /** Formatted value to display */
  value: string;
  /** Optional suffix (e.g. '%') */
  suffix?: string;
  /** Optional color override */
  color?: string;
}

const styles = {
  card: {
    flex: '1 1 0',
    minWidth: '180px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  } as React.CSSProperties,
  title: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '8px',
  } as React.CSSProperties,
  value: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1a1a1a',
  } as React.CSSProperties,
};

export function MetricCard({ title, value, suffix, color }: MetricCardProps) {
  const valueStyle: React.CSSProperties = {
    ...styles.value,
    ...(color ? { color } : {}),
  };

  return (
    <div style={styles.card}>
      <div style={styles.title}>{title}</div>
      <div style={valueStyle}>
        {value}
        {suffix && <span style={{ fontSize: '16px', marginLeft: '2px' }}>{suffix}</span>}
      </div>
    </div>
  );
}
