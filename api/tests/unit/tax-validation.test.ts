/**
 * Unit tests for tax rate validation logic.
 * These tests don't require a database connection.
 */

import { validateTaxRates } from '../../src/services/tax.service';
import { ValidationError } from '../../src/utils/errors';

describe('validateTaxRates', () => {
  it('should accept valid rates within 0-100', () => {
    expect(() => validateTaxRates({ icms: 18, pis: 1.65, cofins: 7.6 })).not.toThrow();
  });

  it('should accept boundary value 0', () => {
    expect(() => validateTaxRates({ icms: 0, pis: 0, cofins: 0 })).not.toThrow();
  });

  it('should accept boundary value 100', () => {
    expect(() => validateTaxRates({ icms: 100, pis: 100, cofins: 100 })).not.toThrow();
  });

  it('should accept empty input (all fields optional)', () => {
    expect(() => validateTaxRates({})).not.toThrow();
  });

  it('should accept dasRate for MEI/Simples', () => {
    expect(() => validateTaxRates({ dasRate: 6.5 })).not.toThrow();
  });

  it('should reject negative rate values', () => {
    expect(() => validateTaxRates({ icms: -1 })).toThrow(ValidationError);
    try {
      validateTaxRates({ icms: -1 });
    } catch (e: any) {
      expect(e.details).toHaveLength(1);
      expect(e.details[0].field).toBe('icms');
      expect(e.details[0].message).toContain('0%');
      expect(e.details[0].message).toContain('100%');
    }
  });

  it('should reject rate values above 100', () => {
    expect(() => validateTaxRates({ pis: 101 })).toThrow(ValidationError);
    try {
      validateTaxRates({ pis: 101 });
    } catch (e: any) {
      expect(e.details).toHaveLength(1);
      expect(e.details[0].field).toBe('pis');
    }
  });

  it('should reject multiple invalid rates and report all errors', () => {
    expect(() => validateTaxRates({ icms: -5, pis: 200, cofins: -0.1 })).toThrow(ValidationError);
    try {
      validateTaxRates({ icms: -5, pis: 200, cofins: -0.1 });
    } catch (e: any) {
      expect(e.details).toHaveLength(3);
      const fields = e.details.map((d: any) => d.field);
      expect(fields).toContain('icms');
      expect(fields).toContain('pis');
      expect(fields).toContain('cofins');
    }
  });

  it('should reject NaN values', () => {
    expect(() => validateTaxRates({ dasRate: NaN })).toThrow(ValidationError);
  });

  it('should accept decimal values within range', () => {
    expect(() => validateTaxRates({ dasRate: 6.5, icms: 18.5, pis: 1.65 })).not.toThrow();
  });

  it('should ignore undefined fields', () => {
    expect(() => validateTaxRates({ icms: undefined, pis: 5 })).not.toThrow();
  });
});
