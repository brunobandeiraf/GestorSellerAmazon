/**
 * Unit tests for validators utility module.
 * Tests CNPJ validation, store name validation, tax regime validation,
 * and the full store input validation function.
 */

import { validateCNPJ, validateStoreName, validateTaxRegime, validateStoreInput, VALID_TAX_REGIMES } from '../../src/utils/validators';
import { ValidationError } from '../../src/utils/errors';

describe('validateCNPJ', () => {
  it('should accept a valid CNPJ (numeric only)', () => {
    // Known valid CNPJ: 11.222.333/0001-81
    expect(validateCNPJ('11222333000181')).toBe(true);
  });

  it('should accept a valid CNPJ with formatting', () => {
    expect(validateCNPJ('11.222.333/0001-81')).toBe(true);
  });

  it('should reject CNPJ with wrong length', () => {
    expect(validateCNPJ('1234567890')).toBe(false);
    expect(validateCNPJ('123456789012345')).toBe(false);
  });

  it('should reject all-same-digit CNPJs', () => {
    expect(validateCNPJ('11111111111111')).toBe(false);
    expect(validateCNPJ('00000000000000')).toBe(false);
    expect(validateCNPJ('99999999999999')).toBe(false);
  });

  it('should reject CNPJ with invalid first check digit', () => {
    // Valid is 11222333000181, change first check digit
    expect(validateCNPJ('11222333000191')).toBe(false);
  });

  it('should reject CNPJ with invalid second check digit', () => {
    // Valid is 11222333000181, change second check digit
    expect(validateCNPJ('11222333000182')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(validateCNPJ('')).toBe(false);
  });

  it('should reject non-numeric strings that result in wrong length', () => {
    expect(validateCNPJ('abcdefghijklmn')).toBe(false);
  });

  it('should accept another known valid CNPJ', () => {
    // CNPJ: 53.113.791/0001-22
    expect(validateCNPJ('53113791000122')).toBe(true);
  });
});

describe('validateStoreName', () => {
  it('should return null for a valid name', () => {
    expect(validateStoreName('Minha Loja')).toBeNull();
  });

  it('should return error for empty string', () => {
    const result = validateStoreName('');
    expect(result).not.toBeNull();
    expect(result!.field).toBe('name');
  });

  it('should return error for whitespace-only string', () => {
    const result = validateStoreName('   ');
    expect(result).not.toBeNull();
    expect(result!.field).toBe('name');
  });

  it('should return error for name exceeding 200 characters', () => {
    const longName = 'a'.repeat(201);
    const result = validateStoreName(longName);
    expect(result).not.toBeNull();
    expect(result!.field).toBe('name');
    expect(result!.message).toContain('200');
  });

  it('should accept name with exactly 200 characters', () => {
    const name = 'a'.repeat(200);
    expect(validateStoreName(name)).toBeNull();
  });
});

describe('validateTaxRegime', () => {
  it('should return null for valid tax regimes', () => {
    expect(validateTaxRegime('MEI')).toBeNull();
    expect(validateTaxRegime('SIMPLES_NACIONAL')).toBeNull();
    expect(validateTaxRegime('LUCRO_PRESUMIDO')).toBeNull();
  });

  it('should return error for invalid tax regime', () => {
    const result = validateTaxRegime('INVALID');
    expect(result).not.toBeNull();
    expect(result!.field).toBe('taxRegime');
  });

  it('should return error for empty string', () => {
    const result = validateTaxRegime('');
    expect(result).not.toBeNull();
    expect(result!.field).toBe('taxRegime');
  });

  it('should be case-sensitive', () => {
    const result = validateTaxRegime('mei');
    expect(result).not.toBeNull();
  });
});

describe('validateStoreInput', () => {
  const validInput = {
    name: 'Minha Loja Amazon',
    cnpj: '11222333000181',
    taxRegime: 'MEI',
  };

  it('should not throw for valid input', () => {
    expect(() => validateStoreInput(validInput)).not.toThrow();
  });

  it('should throw ValidationError for missing name', () => {
    expect(() => validateStoreInput({ ...validInput, name: '' })).toThrow(ValidationError);
  });

  it('should throw ValidationError for invalid CNPJ', () => {
    expect(() => validateStoreInput({ ...validInput, cnpj: '12345678901234' })).toThrow(ValidationError);
  });

  it('should throw ValidationError for invalid tax regime', () => {
    expect(() => validateStoreInput({ ...validInput, taxRegime: 'INVALID' })).toThrow(ValidationError);
  });

  it('should include all errors when multiple fields are invalid', () => {
    try {
      validateStoreInput({ name: '', cnpj: 'invalid', taxRegime: 'WRONG' });
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.details).toBeDefined();
      expect(validationError.details!.length).toBe(3);
    }
  });

  it('should throw ValidationError when all fields are missing', () => {
    try {
      validateStoreInput({});
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.details).toBeDefined();
      expect(validationError.details!.length).toBe(3);
    }
  });

  it('should accept formatted CNPJ', () => {
    expect(() => validateStoreInput({ ...validInput, cnpj: '11.222.333/0001-81' })).not.toThrow();
  });
});
