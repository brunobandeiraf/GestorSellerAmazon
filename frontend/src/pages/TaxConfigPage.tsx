import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { get, put, ApiError } from '../services/api';
import { ApiResponse, Store, TaxConfig, TaxConfigInput, TaxRegime } from '../types';

interface TaxFormErrors {
  icms?: string;
  pis?: string;
  cofins?: string;
  irpj?: string;
  csll?: string;
  dasRate?: string;
}

/** Validates that a rate string is a valid number between 0 and 100 */
function validateRate(value: string): string | undefined {
  if (!value.trim()) return undefined; // empty is treated as 0
  const num = parseFloat(value);
  if (isNaN(num)) return 'Valor deve ser um número válido';
  if (num < 0 || num > 100) return 'Alíquota deve estar entre 0% e 100%';
  return undefined;
}

const styles = {
  container: {
    maxWidth: '480px',
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
  button: {
    width: '100%',
    padding: '10px 16px',
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
  buttonSecondary: {
    width: '100%',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#0066cc',
    backgroundColor: '#fff',
    border: '1px solid #0066cc',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '12px',
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
  regimeLabel: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '16px',
    padding: '8px 12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
  } as React.CSSProperties,
};

const REGIME_LABELS: Record<TaxRegime, string> = {
  MEI: 'MEI',
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
};

export function TaxConfigPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [taxRegime, setTaxRegime] = useState<TaxRegime | null>(null);
  const [isFirstSetup, setIsFirstSetup] = useState(false);

  // Form fields
  const [icms, setIcms] = useState('');
  const [pis, setPis] = useState('');
  const [cofins, setCofins] = useState('');
  const [irpj, setIrpj] = useState('');
  const [csll, setCsll] = useState('');
  const [dasRate, setDasRate] = useState('');

  const [errors, setErrors] = useState<TaxFormErrors>({});
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch store to get tax regime
        const storeResponse = await get<ApiResponse<Store>>('/api/store');
        const store = storeResponse.data;
        setTaxRegime(store.taxRegime);

        // Try to fetch existing tax config
        try {
          const taxResponse = await get<ApiResponse<TaxConfig>>('/api/store/tax');
          const tax = taxResponse.data;
          setIcms(tax.icms ? String(tax.icms) : '');
          setPis(tax.pis ? String(tax.pis) : '');
          setCofins(tax.cofins ? String(tax.cofins) : '');
          setIrpj(tax.irpj ? String(tax.irpj) : '');
          setCsll(tax.csll ? String(tax.csll) : '');
          setDasRate(tax.dasRate ? String(tax.dasRate) : '');
          // If tax config exists, it's not first setup
          setIsFirstSetup(false);
        } catch (err) {
          if (err instanceof ApiError && err.statusCode === 404) {
            // No tax config yet — this is first-time setup
            setIsFirstSetup(true);
          } else {
            throw err;
          }
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setServerError(err.message);
        } else {
          setServerError('Erro ao carregar dados. Tente novamente.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function validateForm(): TaxFormErrors {
    const formErrors: TaxFormErrors = {};

    if (taxRegime === 'MEI' || taxRegime === 'SIMPLES_NACIONAL') {
      const dasError = validateRate(dasRate);
      if (dasError) formErrors.dasRate = dasError;
    } else if (taxRegime === 'LUCRO_PRESUMIDO') {
      const icmsError = validateRate(icms);
      if (icmsError) formErrors.icms = icmsError;

      const pisError = validateRate(pis);
      if (pisError) formErrors.pis = pisError;

      const cofinsError = validateRate(cofins);
      if (cofinsError) formErrors.cofins = cofinsError;

      const irpjError = validateRate(irpj);
      if (irpjError) formErrors.irpj = irpjError;

      const csllError = validateRate(csll);
      if (csllError) formErrors.csll = csllError;
    }

    return formErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    setSuccessMessage('');

    const formErrors = validateForm();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

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
      setSuccessMessage('Configuração de impostos salva com sucesso!');
      // After first setup, allow navigation to integration
      if (isFirstSetup) {
        setIsFirstSetup(true); // keep showing the continue button
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details && err.details.length > 0) {
          const fieldErrors: TaxFormErrors = {};
          for (const detail of err.details) {
            if (['icms', 'pis', 'cofins', 'irpj', 'csll', 'dasRate'].includes(detail.field)) {
              fieldErrors[detail.field as keyof TaxFormErrors] = detail.message;
            }
          }
          setErrors(fieldErrors);
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Erro ao conectar com o servidor. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinue() {
    navigate('/integration');
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Carregando configuração de impostos...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Configuração de Impostos</h1>
      <p style={styles.subtitle}>
        Configure as alíquotas de impostos aplicáveis às suas vendas.
      </p>

      {taxRegime && (
        <div style={styles.regimeLabel}>
          Regime tributário: <strong>{REGIME_LABELS[taxRegime]}</strong>
        </div>
      )}

      {serverError && (
        <div style={styles.serverError} role="alert">
          {serverError}
        </div>
      )}

      {successMessage && (
        <div style={styles.successMessage} role="status">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {(taxRegime === 'MEI' || taxRegime === 'SIMPLES_NACIONAL') && (
          <FormField
            label="Alíquota DAS (%)"
            name="dasRate"
            value={dasRate}
            onChange={setDasRate}
            error={errors.dasRate}
            placeholder="Ex: 5.0"
          />
        )}

        {taxRegime === 'LUCRO_PRESUMIDO' && (
          <>
            <FormField
              label="ICMS (%)"
              name="icms"
              value={icms}
              onChange={setIcms}
              error={errors.icms}
              placeholder="Ex: 18.0"
            />
            <FormField
              label="PIS (%)"
              name="pis"
              value={pis}
              onChange={setPis}
              error={errors.pis}
              placeholder="Ex: 1.65"
            />
            <FormField
              label="COFINS (%)"
              name="cofins"
              value={cofins}
              onChange={setCofins}
              error={errors.cofins}
              placeholder="Ex: 7.6"
            />
            <FormField
              label="IRPJ (%)"
              name="irpj"
              value={irpj}
              onChange={setIrpj}
              error={errors.irpj}
              placeholder="Ex: 15.0"
            />
            <FormField
              label="CSLL (%)"
              name="csll"
              value={csll}
              onChange={setCsll}
              error={errors.csll}
              placeholder="Ex: 9.0"
            />
          </>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          style={
            isSubmitting
              ? { ...styles.button, ...styles.buttonDisabled }
              : styles.button
          }
        >
          {isSubmitting ? 'Salvando...' : 'Salvar Configuração'}
        </button>

        {isFirstSetup && successMessage && (
          <button
            type="button"
            onClick={handleContinue}
            style={styles.buttonSecondary}
          >
            Continuar para Integração
          </button>
        )}
      </form>
    </div>
  );
}
