/**
 * Store service - handles business logic for store CRUD operations.
 * The system is single-store: only one store can exist at a time.
 */

import { prisma } from '../server';
import { validateStoreInput } from '../utils/validators';
import { ConflictError, NotFoundError } from '../utils/errors';
import { StoreInput } from '../types';
import { TaxRegime } from '@prisma/client';

/**
 * Strips non-numeric characters from a CNPJ string.
 */
function stripCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

/**
 * Creates a new store. Only one store can exist in the system.
 * @throws ConflictError if a store already exists
 * @throws ValidationError if input is invalid
 */
export async function createStore(input: StoreInput) {
  // Validate input (throws ValidationError on failure)
  validateStoreInput(input);

  // Check if a store already exists (single-store system)
  const existing = await prisma.store.findFirst();
  if (existing) {
    throw new ConflictError('Uma loja já está cadastrada no sistema');
  }

  const store = await prisma.store.create({
    data: {
      name: input.name.trim(),
      cnpj: stripCNPJ(input.cnpj),
      taxRegime: input.taxRegime as TaxRegime,
    },
  });

  return store;
}

/**
 * Retrieves the store. Returns null if no store exists.
 */
export async function getStore() {
  const store = await prisma.store.findFirst();
  return store;
}

/**
 * Updates the existing store.
 * @throws NotFoundError if no store exists
 * @throws ValidationError if input is invalid
 */
export async function updateStore(input: StoreInput) {
  // Validate input (throws ValidationError on failure)
  validateStoreInput(input);

  // Find the existing store
  const existing = await prisma.store.findFirst();
  if (!existing) {
    throw new NotFoundError('Loja não encontrada');
  }

  const store = await prisma.store.update({
    where: { id: existing.id },
    data: {
      name: input.name.trim(),
      cnpj: stripCNPJ(input.cnpj),
      taxRegime: input.taxRegime as TaxRegime,
    },
  });

  return store;
}
