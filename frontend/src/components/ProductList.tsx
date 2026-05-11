import React, { useState } from 'react';
import { Product } from '../types';

export interface ProductListProps {
  products: Product[];
  onSaveCostPrice: (productId: string, costPrice: number) => Promise<Product>;
}

interface EditState {
  [productId: string]: {
    value: string;
    error: string;
    saving: boolean;
  };
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

const styles = {
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
  } as React.CSSProperties,
  td: {
    padding: '10px 8px',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,
  image: {
    width: '40px',
    height: '40px',
    objectFit: 'cover' as const,
    borderRadius: '4px',
    border: '1px solid #e5e7eb',
  } as React.CSSProperties,
  imagePlaceholder: {
    width: '40px',
    height: '40px',
    borderRadius: '4px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: '#9ca3af',
  } as React.CSSProperties,
  title: {
    fontWeight: 500,
    color: '#1a1a1a',
    maxWidth: '200px',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  subtitle: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '2px',
  } as React.CSSProperties,
  costInput: {
    width: '100px',
    padding: '6px 8px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  costInputError: {
    borderColor: '#dc3545',
  } as React.CSSProperties,
  saveButton: {
    padding: '5px 10px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#0066cc',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginLeft: '6px',
  } as React.CSSProperties,
  saveButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  } as React.CSSProperties,
  errorText: {
    color: '#dc3545',
    fontSize: '11px',
    marginTop: '2px',
  } as React.CSSProperties,
  positive: {
    color: '#16a34a',
    fontWeight: 600,
  } as React.CSSProperties,
  negative: {
    color: '#dc2626',
    fontWeight: 600,
  } as React.CSSProperties,
  neutral: {
    color: '#6b7280',
  } as React.CSSProperties,
  badgeActive: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: '#dcfce7',
    color: '#16a34a',
    border: '1px solid #86efac',
  } as React.CSSProperties,
  badgeInactive: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    border: '1px solid #d1d5db',
  } as React.CSSProperties,
  emptyState: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: '#6b7280',
    fontSize: '14px',
  } as React.CSSProperties,
  costCell: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '2px',
  } as React.CSSProperties,
};

export function ProductList({ products, onSaveCostPrice }: ProductListProps) {
  const [editState, setEditState] = useState<EditState>({});

  function getEditValue(product: Product): string {
    if (editState[product.id]) {
      return editState[product.id].value;
    }
    return product.costPrice != null ? product.costPrice.toString() : '';
  }

  function getEditError(productId: string): string {
    return editState[productId]?.error || '';
  }

  function isSaving(productId: string): boolean {
    return editState[productId]?.saving || false;
  }

  function handleCostChange(productId: string, value: string) {
    setEditState((prev) => ({
      ...prev,
      [productId]: {
        value,
        error: '',
        saving: prev[productId]?.saving || false,
      },
    }));
  }

  function validateCostPrice(value: string): string {
    const trimmed = value.trim();
    if (trimmed === '') {
      return 'Preço de compra é obrigatório';
    }
    const num = parseFloat(trimmed.replace(',', '.'));
    if (isNaN(num)) {
      return 'Valor inválido';
    }
    if (num <= 0) {
      return 'Preço de compra deve ser positivo';
    }
    return '';
  }

  async function handleSave(productId: string) {
    const value = editState[productId]?.value ?? '';
    const error = validateCostPrice(value);

    if (error) {
      setEditState((prev) => ({
        ...prev,
        [productId]: {
          value: prev[productId]?.value || '',
          error,
          saving: false,
        },
      }));
      return;
    }

    const numericValue = parseFloat(value.trim().replace(',', '.'));

    setEditState((prev) => ({
      ...prev,
      [productId]: {
        value: prev[productId]?.value || '',
        error: '',
        saving: true,
      },
    }));

    try {
      await onSaveCostPrice(productId, numericValue);
      // Clear edit state on success - the product will be updated via parent
      setEditState((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    } catch {
      setEditState((prev) => ({
        ...prev,
        [productId]: {
          value: prev[productId]?.value || '',
          error: 'Erro ao salvar. Tente novamente.',
          saving: false,
        },
      }));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, productId: string) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave(productId);
    }
  }

  function renderMetric(value: number | null, suffix: string = '%') {
    if (value == null) {
      return <span style={styles.neutral}>—</span>;
    }
    const style = value >= 0 ? styles.positive : styles.negative;
    return <span style={style}>{value.toFixed(1)}{suffix}</span>;
  }

  if (products.length === 0) {
    return (
      <div style={styles.emptyState}>
        <p>Nenhum produto encontrado.</p>
        <p>Importe produtos pela página de integração.</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}></th>
            <th style={styles.th}>Produto</th>
            <th style={styles.th}>Preço Venda</th>
            <th style={styles.th}>Preço Compra</th>
            <th style={styles.th}>Margem</th>
            <th style={styles.th}>ROI</th>
            <th style={styles.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const editError = getEditError(product.id);
            const saving = isSaving(product.id);
            const inputValue = getEditValue(product);

            return (
              <tr key={product.id}>
                {/* Image */}
                <td style={styles.td}>
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      style={styles.image}
                    />
                  ) : (
                    <div style={styles.imagePlaceholder}>N/A</div>
                  )}
                </td>

                {/* Title + SKU/ASIN */}
                <td style={styles.td}>
                  <div style={styles.title} title={product.title}>
                    {product.title}
                  </div>
                  <div style={styles.subtitle}>
                    SKU: {product.sku} | ASIN: {product.asin}
                  </div>
                </td>

                {/* Selling Price */}
                <td style={styles.td}>
                  {formatBRL(product.sellingPrice)}
                </td>

                {/* Cost Price (editable) */}
                <td style={styles.td}>
                  <div style={styles.costCell}>
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => handleCostChange(product.id, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, product.id)}
                      placeholder="0,00"
                      style={
                        editError
                          ? { ...styles.costInput, ...styles.costInputError }
                          : styles.costInput
                      }
                      aria-label={`Preço de compra de ${product.title}`}
                      aria-invalid={!!editError}
                      disabled={saving}
                    />
                    <button
                      type="button"
                      onClick={() => handleSave(product.id)}
                      disabled={saving}
                      style={
                        saving
                          ? { ...styles.saveButton, ...styles.saveButtonDisabled }
                          : styles.saveButton
                      }
                      aria-label={`Salvar preço de compra de ${product.title}`}
                    >
                      {saving ? '...' : 'Salvar'}
                    </button>
                  </div>
                  {editError && (
                    <div style={styles.errorText} role="alert">
                      {editError}
                    </div>
                  )}
                </td>

                {/* Margin */}
                <td style={styles.td}>
                  {renderMetric(product.margin)}
                </td>

                {/* ROI */}
                <td style={styles.td}>
                  {renderMetric(product.roi)}
                </td>

                {/* Status */}
                <td style={styles.td}>
                  <span
                    style={
                      product.status === 'ACTIVE'
                        ? styles.badgeActive
                        : styles.badgeInactive
                    }
                  >
                    {product.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
