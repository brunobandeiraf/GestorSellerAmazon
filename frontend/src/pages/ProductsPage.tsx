import React, { useEffect, useState } from 'react';
import { ProductList } from '../components/ProductList';
import { get, put, ApiError } from '../services/api';
import { ApiResponse, Product } from '../types';

const styles = {
  container: {
    maxWidth: '960px',
    margin: '40px auto',
    padding: '32px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,
  title: {
    fontSize: '24px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#1a1a1a',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '24px',
  } as React.CSSProperties,
  loading: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#666',
    fontSize: '14px',
  } as React.CSSProperties,
  serverError: {
    padding: '12px',
    marginBottom: '16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    color: '#dc3545',
    fontSize: '13px',
  } as React.CSSProperties,
};

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await get<ApiResponse<Product[]>>('/api/products');
        setProducts(response.data);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Erro ao carregar produtos.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  async function handleSaveCostPrice(productId: string, costPrice: number): Promise<Product> {
    const response = await put<ApiResponse<Product>>(
      `/api/products/${productId}/cost`,
      { costPrice }
    );
    const updatedProduct = response.data;

    // Update the product in the local list
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? updatedProduct : p))
    );

    return updatedProduct;
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Carregando produtos...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Produtos</h1>
      <p style={styles.subtitle}>
        Gerencie seus produtos e informe o preço de compra para calcular margem e ROI.
      </p>

      {error && (
        <div style={styles.serverError} role="alert">
          {error}
        </div>
      )}

      <ProductList products={products} onSaveCostPrice={handleSaveCostPrice} />
    </div>
  );
}
