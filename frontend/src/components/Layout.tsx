import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

const styles = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
  } as React.CSSProperties,
  content: {
    flex: 1,
    padding: '24px 32px',
    backgroundColor: '#f9fafb',
    overflowY: 'auto' as const,
  } as React.CSSProperties,
};

export function Layout() {
  return (
    <div style={styles.wrapper}>
      <Sidebar />
      <main style={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
