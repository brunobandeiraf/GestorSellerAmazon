/**
 * Validation utilities for the Amazon Sales Manager API.
 * Includes CNPJ validation, required field checks, and tax regime validation.
 */

import { ValidationError, ErrorDetail } from './errors';

/** Valid tax regime values */
export const VALID_TAX_REGIMES = ['MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO'] as const;
export type TaxRegimeValue = (typeof VALID_TAX_REGIMES)[number];

/**
 * Strips non-numeric characters from a string.
 */
function stripNonNumeric(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Validates a Brazilian CNPJ number.
 * Checks:
 * - Exactly 14 digits after stripping non-numeric characters
 * - Not all same digits (e.g., 11111111111111)
 * - Both check digits (dígitos verificadores) are valid
 *
 * @param cnpj - The CNPJ string to validate (may contain formatting)
 * @returns true if valid, false otherwise
 */
export function validateCNPJ(cnpj: string): boolean {
  const digits = stripNonNumeric(cnpj);

  // Must be exactly 14 digits
  if (digits.length !== 14) {
    return false;
  }

  // Reject all-same-digit CNPJs
  if (/^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  // Validate first check digit (position 12)
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights1[i];
  }
  let remainder = sum % 11;
  const firstCheckDigit = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(digits[12], 10) !== firstCheckDigit) {
    return false;
  }

  // Validate second check digit (position 13)
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i], 10) * weights2[i];
  }
  remainder = sum % 11;
  const secondCheckDigit = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(digits[13], 10) !== secondCheckDigit) {
    return false;
  }

  return true;
}

/**
 * Validates the store name field.
 * - Must not be empty or whitespace-only
 * - Must not exceed 200 characters
 *
 * @param name - The store name to validate
 * @returns An error detail if invalid, or null if valid
 */
export function validateStoreName(name: string): ErrorDetail | null {
  if (!name || name.trim().length === 0) {
    return { field: 'name', message: 'Nome da loja é obrigatório' };
  }
  if (name.trim().length > 200) {
    return { field: 'name', message: 'Nome da loja deve ter no máximo 200 caracteres' };
  }
  return null;
}

/**
 * Validates the tax regime value.
 * Must be one of: MEI, SIMPLES_NACIONAL, LUCRO_PRESUMIDO
 *
 * @param taxRegime - The tax regime string to validate
 * @returns An error detail if invalid, or null if valid
 */
export function validateTaxRegime(taxRegime: string): ErrorDetail | null {
  if (!taxRegime || !VALID_TAX_REGIMES.includes(taxRegime as TaxRegimeValue)) {
    return {
      field: 'taxRegime',
      message: `Regime tributário inválido. Valores aceitos: ${VALID_TAX_REGIMES.join(', ')}`,
    };
  }
  return null;
}

/**
 * Validates the full store creation/update input payload.
 * Checks name, CNPJ, and tax regime.
 * Throws a ValidationError if any field is invalid.
 *
 * @param input - The store input payload
 * @throws ValidationError with details of all invalid fields
 */
export function validateStoreInput(input: { name?: string; cnpj?: string; taxRegime?: string }): void {
  const errors: ErrorDetail[] = [];

  // Validate name
  if (input.name === undefined || input.name === null) {
    errors.push({ field: 'name', message: 'Nome da loja é obrigatório' });
  } else {
    const nameError = validateStoreName(input.name);
    if (nameError) {
      errors.push(nameError);
    }
  }

  // Validate CNPJ
  if (!input.cnpj || input.cnpj.trim().length === 0) {
    errors.push({ field: 'cnpj', message: 'CNPJ é obrigatório' });
  } else if (!validateCNPJ(input.cnpj)) {
    errors.push({ field: 'cnpj', message: 'CNPJ inválido' });
  }

  // Validate tax regime
  if (!input.taxRegime || input.taxRegime.trim().length === 0) {
    errors.push({ field: 'taxRegime', message: 'Regime tributário é obrigatório' });
  } else {
    const taxRegimeError = validateTaxRegime(input.taxRegime);
    if (taxRegimeError) {
      errors.push(taxRegimeError);
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Dados da loja inválidos', errors);
  }
}
