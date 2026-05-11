/**
 * Unit tests for margin.service.ts
 * Tests the pure calculation functions: calculateTotalTaxRate and calculateMarginAndRoi
 */

import { TaxRegime } from '@prisma/client';
import {
  calculateTotalTaxRate,
  calculateMarginAndRoi,
  TaxConfigData,
} from '../../src/services/margin.service';

describe('margin.service', () => {
  describe('calculateTotalTaxRate', () => {
    const baseTaxConfig: TaxConfigData = {
      icms: 18,
      pis: 1.65,
      cofins: 7.6,
      irpj: 15,
      csll: 9,
      dasRate: 6,
    };

    it('should return dasRate for MEI regime', () => {
      const rate = calculateTotalTaxRate(baseTaxConfig, TaxRegime.MEI);
      expect(rate).toBe(6);
    });

    it('should return dasRate for SIMPLES_NACIONAL regime', () => {
      const rate = calculateTotalTaxRate(baseTaxConfig, TaxRegime.SIMPLES_NACIONAL);
      expect(rate).toBe(6);
    });

    it('should return sum of individual rates for LUCRO_PRESUMIDO regime', () => {
      const rate = calculateTotalTaxRate(baseTaxConfig, TaxRegime.LUCRO_PRESUMIDO);
      // 18 + 1.65 + 7.6 + 15 + 9 = 51.25
      expect(rate).toBeCloseTo(51.25, 2);
    });

    it('should return 0 when all rates are 0', () => {
      const zeroConfig: TaxConfigData = {
        icms: 0,
        pis: 0,
        cofins: 0,
        irpj: 0,
        csll: 0,
        dasRate: 0,
      };
      expect(calculateTotalTaxRate(zeroConfig, TaxRegime.MEI)).toBe(0);
      expect(calculateTotalTaxRate(zeroConfig, TaxRegime.LUCRO_PRESUMIDO)).toBe(0);
    });
  });

  describe('calculateMarginAndRoi', () => {
    it('should calculate margin, ROI, and netProfit correctly', () => {
      // sellingPrice=100, costPrice=50, taxRate=10%, amazonFee=15
      // taxAmount = 100 * 0.10 = 10
      // netProfit = 100 - 50 - 10 - 15 = 25
      // margin = (25 / 100) * 100 = 25%
      // roi = (25 / 50) * 100 = 50%
      const result = calculateMarginAndRoi(100, 50, 10, 15);
      expect(result.netProfit).toBe(25);
      expect(result.margin).toBe(25);
      expect(result.roi).toBe(50);
    });

    it('should handle zero tax rate', () => {
      // sellingPrice=100, costPrice=40, taxRate=0%, amazonFee=15
      // netProfit = 100 - 40 - 0 - 15 = 45
      // margin = (45 / 100) * 100 = 45%
      // roi = (45 / 40) * 100 = 112.5%
      const result = calculateMarginAndRoi(100, 40, 0, 15);
      expect(result.netProfit).toBe(45);
      expect(result.margin).toBe(45);
      expect(result.roi).toBe(112.5);
    });

    it('should handle zero amazon fee', () => {
      // sellingPrice=100, costPrice=60, taxRate=10%, amazonFee=0
      // taxAmount = 100 * 0.10 = 10
      // netProfit = 100 - 60 - 10 - 0 = 30
      // margin = (30 / 100) * 100 = 30%
      // roi = (30 / 60) * 100 = 50%
      const result = calculateMarginAndRoi(100, 60, 10, 0);
      expect(result.netProfit).toBe(30);
      expect(result.margin).toBe(30);
      expect(result.roi).toBe(50);
    });

    it('should return negative margin when costs exceed selling price', () => {
      // sellingPrice=100, costPrice=80, taxRate=20%, amazonFee=15
      // taxAmount = 100 * 0.20 = 20
      // netProfit = 100 - 80 - 20 - 15 = -15
      // margin = (-15 / 100) * 100 = -15%
      // roi = (-15 / 80) * 100 = -18.75%
      const result = calculateMarginAndRoi(100, 80, 20, 15);
      expect(result.netProfit).toBe(-15);
      expect(result.margin).toBe(-15);
      expect(result.roi).toBe(-18.75);
    });

    it('should round results to 2 decimal places', () => {
      // sellingPrice=99, costPrice=33, taxRate=7.5%, amazonFee=12.34
      // taxAmount = 99 * 0.075 = 7.425
      // netProfit = 99 - 33 - 7.425 - 12.34 = 46.235 → 46.24
      // margin = (46.235 / 99) * 100 = 46.7020... → 46.7
      // roi = (46.235 / 33) * 100 = 140.1060... → 140.11
      const result = calculateMarginAndRoi(99, 33, 7.5, 12.34);
      expect(result.netProfit).toBe(46.24);
      expect(result.margin).toBe(46.7);
      expect(result.roi).toBe(140.11);
    });

    it('should handle very small margins', () => {
      // sellingPrice=100, costPrice=70, taxRate=15%, amazonFee=14.99
      // taxAmount = 100 * 0.15 = 15
      // netProfit = 100 - 70 - 15 - 14.99 = 0.01
      // margin = (0.01 / 100) * 100 = 0.01%
      // roi = (0.01 / 70) * 100 = 0.014... → 0.01%
      const result = calculateMarginAndRoi(100, 70, 15, 14.99);
      expect(result.netProfit).toBe(0.01);
      expect(result.margin).toBe(0.01);
      expect(result.roi).toBe(0.01);
    });
  });
});
