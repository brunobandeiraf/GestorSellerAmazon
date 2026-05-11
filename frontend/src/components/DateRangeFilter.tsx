import React, { useState } from 'react';

export interface DateRangeFilterProps {
  /** Called when the user clicks "Filtrar" */
  onFilter: (startDate: string, endDate: string) => void;
  /** Initial start date (YYYY-MM-DD) */
  initialStartDate?: string;
  /** Initial end date (YYYY-MM-DD) */
  initialEndDate?: string;
}

function getTodayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
  } as React.CSSProperties,
  input: {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  button: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#0066cc',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  } as React.CSSProperties,
};

export function DateRangeFilter({ onFilter, initialStartDate, initialEndDate }: DateRangeFilterProps) {
  const today = getTodayString();
  const [startDate, setStartDate] = useState(initialStartDate || today);
  const [endDate, setEndDate] = useState(initialEndDate || today);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onFilter(startDate, endDate);
  }

  return (
    <form onSubmit={handleSubmit} style={styles.container}>
      <label style={styles.label} htmlFor="filter-start-date">De:</label>
      <input
        id="filter-start-date"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        style={styles.input}
      />
      <label style={styles.label} htmlFor="filter-end-date">Até:</label>
      <input
        id="filter-end-date"
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        style={styles.input}
      />
      <button type="submit" style={styles.button}>
        Filtrar
      </button>
    </form>
  );
}
