import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { post, ApiError } from '../services/api';
import { ApiResponse, Store, TaxRegime } from '../types';

const TAX_REGIME_OPTIONS = [
  { value: 'MEI', label: 'MEI' },
  { value: 'SIMPLES_NACIONAL', label: 'Simples Nacional' },
  { value: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido' },
];

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

/** Validates CNPJ format (14 digits with valid check digits) */
function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;

  // Check for all same digits
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // Validate first check digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const firstCheck = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[12]) !== firstCheck) return false;

  // Validate second check digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i]) * weights2[i];
  }
  remainder = sum % 11;
  const secondCheck = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[13]) !== secondCheck) return false;

  return true;
}

interface FormErrors {
  name?: string;
  cnpj?: string;
  taxRegime?: string;
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

export function SetupStorePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [taxRegime, setTaxRegime] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm(): FormErrors {
    const formErrors: FormErrors = {};

    if (!name.trim()) {
      formErrors.name = 'Nome da loja é obrigatório';
    } else if (name.trim().length > 200) {
      formErrors.name = 'Nome da loja deve ter no máximo 200 caracteres';
    }

    if (!cnpj.trim()) {
      formErrors.cnpj = 'CNPJ é obrigatório';
    } else if (!validateCnpj(cnpj)) {
      formErrors.cnpj = 'CNPJ inválido. Use o formato XX.XXX.XXX/XXXX-XX';
    }

    if (!taxRegime) {
      formErrors.taxRegime = 'Regime tributário é obrigatório';
    }

    return formErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');

    const formErrors = validateForm();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await post<ApiResponse<Store>>('/api/store', {
        name: name.trim(),
        cnpj: cnpj.replace(/\D/g, ''),
        taxRegime: taxRegime as TaxRegime,
      });
      navigate('/tax-config');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details && err.details.length > 0) {
          const fieldErrors: FormErrors = {};
          for (const detail of err.details) {
            if (detail.field in fieldErrors || ['name', 'cnpj', 'taxRegime'].includes(detail.field)) {
              fieldErrors[detail.field as keyof FormErrors] = detail.message;
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

  function handleCnpjChange(value: string) {
    setCnpj(applyCnpjMask(value));
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Cadastro da Loja</h1>
      <p style={styles.subtitle}>
        Preencha os dados da sua loja para começar a gerenciar suas vendas.
      </p>

      {serverError && (
        <div style={styles.serverError} role="alert">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Nome da Loja"
          name="name"
          value={name}
          onChange={setName}
          error={errors.name}
          placeholder="Ex: Minha Loja Amazon"
          required
        />

        <FormField
          label="CNPJ"
          name="cnpj"
          value={cnpj}
          onChange={handleCnpjChange}
          error={errors.cnpj}
          placeholder="XX.XXX.XXX/XXXX-XX"
          required
        />

        <FormField
          label="Regime Tributário"
          name="taxRegime"
          type="select"
          value={taxRegime}
          onChange={setTaxRegime}
          error={errors.taxRegime}
          options={TAX_REGIME_OPTIONS}
          required
        />

        <button
          type="submit"
          disabled={isSubmitting}
          style={
            isSubmitting
              ? { ...styles.button, ...styles.buttonDisabled }
              : styles.button
          }
        >
          {isSubmitting ? 'Cadastrando...' : 'Cadastrar Loja'}
        </button>
      </form>
    </div>
  );
}
