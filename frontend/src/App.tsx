import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SetupStorePage } from './pages/SetupStorePage';
import { TaxConfigPage } from './pages/TaxConfigPage';
import { IntegrationPage } from './pages/IntegrationPage';
import { ProductsPage } from './pages/ProductsPage';
import { DashboardPage } from './pages/DashboardPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { Layout } from './components/Layout';
import { useStore } from './hooks/useStore';

function AppRoutes() {
  const { loading, hasStore } = useStore();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#6b7280' }}>
        Carregando...
      </div>
    );
  }

  if (!hasStore) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupStorePage />} />
        <Route path="/tax-config" element={<TaxConfigPage />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/sales" element={<SalesHistoryPage />} />
        <Route path="/integration" element={<IntegrationPage />} />
        <Route path="/tax-config" element={<TaxConfigPage />} />
      </Route>
      <Route path="/setup" element={<Navigate to="/dashboard" replace />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
