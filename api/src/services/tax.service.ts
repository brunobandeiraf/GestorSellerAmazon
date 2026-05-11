/**
 * Tax service - handles business logic for tax configuration.
 * Manages tax rates (alíquotas) for the store based on its tax regime.
 *
 * MEI / Simples Nacional → dasRate (single DAS rate)
 * Lucro Presumido → icms, pis, cofins, irpj, csll (individual rates)
 */

import { prisma } from '../server';
import { NotFoundError, ValidationError, ErrorDetail } from '../utils/errors';
import { TaxConfigInput } from '../types';
import { recalculateAllProductMargins } from './margin.service';

/** All rate fields that can be validated */
const RATE_FIELDS = ['icms', 'pis', 'cofins', 'irpj', 'csll', 'dasRate'] as const;

/**
 * Validates that all provided tax rate values are between 0 and 100 (inclusive).
 * @throws ValidationError if any rate is out of range
 */
export function validateTaxRates(input: TaxConfigInput): void {
  const errors: ErrorDetail[] = [];

  for (const field of RATE_FIELDS) {
    const value = input[field];
    if (value !== undefined && value !== null) {
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push({
          field,
          message: `Alíquota de ${field} deve ser um número válido`,
        });
      } else if (value < 0 || value > 100) {
        errors.push({
          field,
          message: 'Alíquota deve estar entre 0% e 100%',
        });
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Configuração de impostos inválida', errors);
  }
}

/**
 * Retrieves the tax configuration for the store.
 * @throws NotFoundError if no store exists
 * @returns The tax config or null if not yet configured
 */
export async function getTaxConfig() {
  const store = await prisma.store.findFirst({
    include: { taxConfig: true },
  });

  if (!store) {
    throw new NotFoundError('Loja não encontrada');
  }

  return store.taxConfig;
}

/**
 * Creates or updates the tax configuration for the store (upsert).
 * @throws NotFoundError if no store exists
 * @throws ValidationError if any rate value is out of range
 */
export async function saveTaxConfig(input: TaxConfigInput) {
  // Validate rates
  validateTaxRates(input);

  // Find the store
  const store = await prisma.store.findFirst();
  if (!store) {
    throw new NotFoundError('Loja não encontrada');
  }

  // Upsert tax config
  const taxConfig = await prisma.taxConfig.upsert({
    where: { storeId: store.id },
    create: {
      storeId: store.id,
      icms: input.icms ?? 0,
      pis: input.pis ?? 0,
      cofins: input.cofins ?? 0,
      irpj: input.irpj ?? 0,
      csll: input.csll ?? 0,
      dasRate: input.dasRate ?? 0,
    },
    update: {
      icms: input.icms ?? 0,
      pis: input.pis ?? 0,
      cofins: input.cofins ?? 0,
      irpj: input.irpj ?? 0,
      csll: input.csll ?? 0,
      dasRate: input.dasRate ?? 0,
    },
  });

  // Recalculate margins for all products when tax config changes
  await recalculateAllProductMargins(store.id);

  return taxConfig;
}
