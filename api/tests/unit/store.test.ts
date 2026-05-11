/**
 * Unit tests for store service and routes.
 * Tests the store CRUD operations and HTTP endpoints.
 */

import request from 'supertest';
import app, { prisma } from '../../src/server';

// Valid CNPJ for testing: 11.222.333/0001-81
const validStoreInput = {
  name: 'Minha Loja Amazon',
  cnpj: '11.222.333/0001-81',
  taxRegime: 'MEI',
};

// Another valid CNPJ: 53.113.791/0001-22
const updatedStoreInput = {
  name: 'Loja Atualizada',
  cnpj: '53.113.791/0001-22',
  taxRegime: 'LUCRO_PRESUMIDO',
};

beforeEach(async () => {
  // Clean up the store table before each test
  await prisma.store.deleteMany();
});

afterAll(async () => {
  await prisma.store.deleteMany();
  await prisma.$disconnect();
});

describe('GET /api/store', () => {
  it('should return null data when no store exists', async () => {
    const res = await request(app).get('/api/store');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('should return the store when it exists', async () => {
    // Create a store directly in the database
    await prisma.store.create({
      data: {
        name: 'Test Store',
        cnpj: '11222333000181',
        taxRegime: 'MEI',
      },
    });

    const res = await request(app).get('/api/store');
    expect(res.status).toBe(200);
    expect(res.body.data).not.toBeNull();
    expect(res.body.data.name).toBe('Test Store');
    expect(res.body.data.cnpj).toBe('11222333000181');
    expect(res.body.data.taxRegime).toBe('MEI');
  });
});

describe('POST /api/store', () => {
  it('should create a store with valid input', async () => {
    const res = await request(app).post('/api/store').send(validStoreInput);
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Minha Loja Amazon');
    // CNPJ should be stored as digits only
    expect(res.body.data.cnpj).toBe('11222333000181');
    expect(res.body.data.taxRegime).toBe('MEI');
    expect(res.body.data.id).toBeDefined();
  });

  it('should strip CNPJ formatting before storing', async () => {
    const res = await request(app).post('/api/store').send({
      name: 'Loja Test',
      cnpj: '11.222.333/0001-81',
      taxRegime: 'SIMPLES_NACIONAL',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.cnpj).toBe('11222333000181');
  });

  it('should trim the store name', async () => {
    const res = await request(app).post('/api/store').send({
      ...validStoreInput,
      name: '  Minha Loja  ',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Minha Loja');
  });

  it('should return 409 if a store already exists', async () => {
    // Create first store
    await request(app).post('/api/store').send(validStoreInput);

    // Try to create another
    const res = await request(app).post('/api/store').send(updatedStoreInput);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should return 400 for invalid CNPJ', async () => {
    const res = await request(app).post('/api/store').send({
      ...validStoreInput,
      cnpj: '12345678901234',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
    expect(res.body.error.details.some((d: any) => d.field === 'cnpj')).toBe(true);
  });

  it('should return 400 for missing required fields', async () => {
    const res = await request(app).post('/api/store').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBe(3);
  });

  it('should return 400 for invalid tax regime', async () => {
    const res = await request(app).post('/api/store').send({
      ...validStoreInput,
      taxRegime: 'INVALID',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some((d: any) => d.field === 'taxRegime')).toBe(true);
  });
});

describe('PUT /api/store', () => {
  it('should update an existing store', async () => {
    // Create a store first
    await request(app).post('/api/store').send(validStoreInput);

    // Update it
    const res = await request(app).put('/api/store').send(updatedStoreInput);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Loja Atualizada');
    expect(res.body.data.cnpj).toBe('53113791000122');
    expect(res.body.data.taxRegime).toBe('LUCRO_PRESUMIDO');
  });

  it('should return 404 if no store exists', async () => {
    const res = await request(app).put('/api/store').send(updatedStoreInput);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return 400 for invalid input on update', async () => {
    // Create a store first
    await request(app).post('/api/store').send(validStoreInput);

    // Try to update with invalid data
    const res = await request(app).put('/api/store').send({
      name: '',
      cnpj: 'invalid',
      taxRegime: 'WRONG',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should strip CNPJ formatting on update', async () => {
    await request(app).post('/api/store').send(validStoreInput);

    const res = await request(app).put('/api/store').send({
      name: 'Updated',
      cnpj: '53.113.791/0001-22',
      taxRegime: 'MEI',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.cnpj).toBe('53113791000122');
  });
});
