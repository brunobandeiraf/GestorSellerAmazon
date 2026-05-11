import React, { useEffect, useState } from 'react';
import { FormField } from '../components/FormField';
import { get, put, ApiError } from '../services/api';
import { ApiResponse, Store, TaxConfig, TaxConfigInput } from '../types';

/** Applies CNPJ mask: XX.XXX.XXX/XXXX-XX */
function applyCnpjMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  let masked = digits;
  if (digits.length > 2) masked = digits.slice(0, 2) + '.' + digits.slice(2);
  if (digits.length > 5) masked = masked.slice(0, 6) + '.' + digits.slice(5);
  if (digits.length > 8) masked = masked.slice(0, 10) + '/' + digits.slice(8);
  if (digits.length > 12) masked = masked.slice(0, 15) + '-' + digits.slice(12);
  return masked;
}

function validateRate(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const num = parseFloat(value);
  if (isNaN(num)) return 'Valor deve ser um número válido';
  if (num < 0 || num > 100) return 'Alíquota deve estar entre 0% e 100%';
  return undefined;
}

const TAX_REGIME_OPTIONS = [
  { value: 'MEI', label: 'MEI' },
  { value: 'SIMPLES_NACIONAL', label: 'Simples Nacional' },
  { value: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido' },
];

const styles = {
  page: {
    maxWidth: '600px',
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
    marginBottom: '32px',
  } as React.CSSProperties,
  section: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '24px',
    marginBottom: '24px',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1a1a1a',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e5e7eb',
  } as React.CSSProperties,
  button: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#0066cc',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '8px',
  } as React.CSSProperties,
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
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
  successMessage: {
    padding: '12px',
    marginBottom: '16px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '4px',
    color: '#16a34a',
    fontSize: '13px',
  } as React.CSSProperties,
  loading: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#666',
    fontSize: '14px',
  } as React.CSSProperties,
};

export function SettingsPage() {
  const [loading, setLoading] = useState(true);

  // Store fields
  const [storeName, setStoreName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [taxRegime, setTaxRegime] = useState('');
  const [storeErrors, setStoreErrors] = useState<Record<string, string>>({});
  const [storeSuccess, setStoreSuccess] = useState('');
  const [storeError, setStoreError] = useState('');
  const [savingStore, setSavingStore] = useState(false);

  // Tax fields
  const [icms, setIcms] = useState('');
  const [pis, setPis] = useState('');
  const [cofins, setCofins] = useState('');
  const [irpj, setIrpj] = useState('');
  const [csll, setCsll] = useState('');
  const [dasRate, setDasRate] = useState('');
  const [taxErrors, setTaxErrors] = useState<Record<string, string>>({});
  const [taxSuccess, setTaxSuccess] = useState('');
  const [taxError, setTaxError] = useState('');
  const [savingTax, setSavingTax] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const storeResponse = await get<ApiResponse<Store>>('/api/store');
        const store = storeResponse.data;
        if (store) {
          setStoreName(store.name);
          setCnpj(applyCnpjMask(store.cnpj));
          setTaxRegime(store.taxRegime);
        }

        try {
          const taxResponse = await get<ApiResponse<TaxConfig | null>>('/api/store/tax');
          const tax = taxResponse.data;
          if (tax) {
            setIcms(tax.icms ? String(tax.icms) : '');
            setPis(tax.pis ? String(tax.pis) : '');
            setCofins(tax.cofins ? String(tax.cofins) : '');
            setIrpj(tax.irpj ? String(tax.irpj) : '');
            setCsll(tax.csll ? String(tax.csll) : '');
            setDasRate(tax.dasRate ? String(tax.dasRate) : '');
          }
        } catch {
          // No tax config yet, fields stay empty
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setStoreError(err.message);
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleSaveStore(e: React.FormEvent) {
    e.preventDefault();
    setStoreErrors({});
    setStoreSuccess('');
    setStoreError('');

    const errors: Record<string, string> = {};
    if (!storeName.trim()) errors.name = 'Nome da loja é obrigatório';
    if (!cnpj.trim()) errors.cnpj = 'CNPJ é obrigatório';
    if (!taxRegime) errors.taxRegime = 'Regime tributário é obrigatório';

    if (Object.keys(errors).length > 0) {
      setStoreErrors(errors);
      return;
    }

    setSavingStore(true);
    try {
      await put<ApiResponse<Store>>('/api/store', {
        name: storeName.trim(),
        cnpj: cnpj.replace(/\D/g, ''),
        taxRegime,
      });
      setStoreSuccess('Dados da loja salvos com sucesso!');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details && err.details.length > 0) {
          const fieldErrors: Record<string, string> = {};
          for (const d of err.details) {
            fieldErrors[d.field] = d.message;
          }
          setStoreErrors(fieldErrors);
        } else {
          setStoreError(err.message);
        }
      } else {
        setStoreError('Erro ao salvar. Tente novamente.');
      }
    } finally {
      setSavingStore(false);
    }
  }

  async function handleSaveTax(e: React.FormEvent) {
    e.preventDefault();
    setTaxErrors({});
    setTaxSuccess('');
    setTaxError('');

    const errors: Record<string, string> = {};
    if (taxRegime === 'MEI' || taxRegime === 'SIMPLES_NACIONAL') {
      const err = validateRate(dasRate);
      if (err) errors.dasRate = err;
    } else if (taxRegime === 'LUCRO_PRESUMIDO') {
      const fields = { icms, pis, cofins, irpj, csll };
      for (const [key, val] of Object.entries(fields)) {
        const err = validateRate(val);
        if (err) errors[key] = err;
      }
    }

    if (Object.keys(errors).length > 0) {
      setTaxErrors(errors);
      return;
    }

    setSavingTax(true);
    try {
      const payload: TaxConfigInput = {};
      if (taxRegime === 'MEI' || taxRegime === 'SIMPLES_NACIONAL') {
        payload.dasRate = dasRate.trim() ? parseFloat(dasRate) : 0;
      } else if (taxRegime === 'LUCRO_PRESUMIDO') {
        payload.icms = icms.trim() ? parseFloat(icms) : 0;
        payload.pis = pis.trim() ? parseFloat(pis) : 0;
        payload.cofins = cofins.trim() ? parseFloat(cofins) : 0;
        payload.irpj = irpj.trim() ? parseFloat(irpj) : 0;
        payload.csll = csll.trim() ? parseFloat(csll) : 0;
      }

      await put<ApiResponse<TaxConfig>>('/api/store/tax', payload);
      setTaxSuccess('Configuração de impostos salva com sucesso!');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details && err.details.length > 0) {
          const fieldErrors: Record<string, string> = {};
          for (const d of err.details) {
            fieldErrors[d.field] = d.message;
          }
          setTaxErrors(fieldErrors);
        } else {
          setTaxError(err.message);
        }
      } else {
        setTaxError('Erro ao salvar. Tente novamente.');
      }
    } finally {
      setSavingTax(false);
    }
  }

  function handleCnpjChange(value: string) {
    setCnpj(applyCnpjMask(value));
  }

  if (loading) {
    return <div style={styles.loading}>Carregando configurações...</div>;
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Configurações</h1>
      <p style={styles.subtitle}>Gerencie os dados da sua loja e configuração de impostos.</p>

      {/* Store Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Dados da Loja</h2>

        {storeError && <div style={styles.serverError}>{storeError}</div>}
        {storeSuccess && <div style={styles.successMessage}>{storeSuccess}</div>}

        <form onSubmit={handleSaveStore} noValidate>
          <FormField
            label="Nome da Loja"
            name="storeName"
            value={storeName}
            onChange={setStoreName}
            error={storeErrors.name}
            placeholder="Ex: Minha Loja Amazon"
            required
          />
          <FormField
            label="CNPJ"
            name="cnpj"
            value={cnpj}
            onChange={handleCnpjChange}
            error={storeErrors.cnpj}
            placeholder="XX.XXX.XXX/XXXX-XX"
            required
          />
          <FormField
            label="Regime Tributário"
            name="taxRegime"
            type="select"
            value={taxRegime}
            onChange={setTaxRegime}
            error={storeErrors.taxRegime}
            options={TAX_REGIME_OPTIONS}
            required
          />
          <button
            type="submit"
            disabled={savingStore}
            style={savingStore ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
          >
            {savingStore ? 'Salvando...' : 'Salvar Loja'}
          </button>
        </form>
      </div>

      {/* Tax Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Impostos</h2>

        {taxError && <div style={styles.serverError}>{taxError}</div>}
        {taxSuccess && <div style={styles.successMessage}>{taxSuccess}</div>}

        <form onSubmit={handleSaveTax} noValidate>
          {(taxRegime === 'MEI' || taxRegime === 'SIMPLES_NACIONAL') && (
            <FormField
              label="Alíquota DAS (%)"
              name="dasRate"
              value={dasRate}
              onChange={setDasRate}
              error={taxErrors.dasRate}
              placeholder="Ex: 5.0"
            />
          )}

          {taxRegime === 'LUCRO_PRESUMIDO' && (
            <>
              <FormField label="ICMS (%)" name="icms" value={icms} onChange={setIcms} error={taxErrors.icms} placeholder="Ex: 18.0" />
              <FormField label="PIS (%)" name="pis" value={pis} onChange={setPis} error={taxErrors.pis} placeholder="Ex: 1.65" />
              <FormField label="COFINS (%)" name="cofins" value={cofins} onChange={setCofins} error={taxErrors.cofins} placeholder="Ex: 7.6" />
              <FormField label="IRPJ (%)" name="irpj" value={irpj} onChange={setIrpj} error={taxErrors.irpj} placeholder="Ex: 15.0" />
              <FormField label="CSLL (%)" name="csll" value={csll} onChange={setCsll} error={taxErrors.csll} placeholder="Ex: 9.0" />
            </>
          )}

          {!taxRegime && (
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              Selecione o regime tributário na seção acima para configurar os impostos.
            </p>
          )}

          {taxRegime && (
            <button
              type="submit"
              disabled={savingTax}
              style={savingTax ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
            >
              {savingTax ? 'Salvando...' : 'Salvar Impostos'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
