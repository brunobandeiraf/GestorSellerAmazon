import React from 'react';
import { NavLink } from 'react-router-dom';

const styles = {
  sidebar: {
    width: '220px',
    minHeight: '100vh',
    backgroundColor: '#1f2937',
    padding: '20px 0',
    display: 'flex',
    flexDirection: 'column' as const,
  } as React.CSSProperties,
  logo: {
    padding: '0 20px 20px',
    fontSize: '16px',
    fontWeight: 700,
    color: '#fff',
    borderBottom: '1px solid #374151',
    marginBottom: '12px',
  } as React.CSSProperties,
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    padding: '0 8px',
  } as React.CSSProperties,
  link: {
    display: 'block',
    padding: '10px 12px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    color: '#d1d5db',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,
  activeLink: {
    backgroundColor: '#374151',
    color: '#fff',
  } as React.CSSProperties,
};

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/products', label: 'Produtos' },
  { to: '/sales', label: 'Vendas' },
  { to: '/integration', label: 'Integração' },
  { to: '/tax-config', label: 'Impostos' },
];

export function Sidebar() {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>Amazon Sales Manager</div>
      <nav style={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.activeLink : {}),
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
