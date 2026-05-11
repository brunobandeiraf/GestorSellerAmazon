/**
 * Unit tests for tax service and routes.
 * Tests the tax configuration CRUD operations and HTTP endpoints.
 */

import request from 'supertest';
import app, { prisma } from '../../src/server';

// Valid CNPJ for testing: 11.222.333/0001-81
const validStoreInput = {
  name: 'Minha Loja Amazon',
  cnpj: '11.222.333/0001-81',
  taxRegime: 'MEI',
};

beforeEach(async () => {
  // Clean up in correct order (tax config depends on store)
  await prisma.taxConfig.deleteMany();
  await prisma.store.deleteMany();
});

afterAll(async () => {
  await prisma.taxConfig.deleteMany();
  await prisma.store.deleteMany();
  await prisma.$disconnect();
});

describe('GET /api/store/tax', () => {
  it('should return 404 when no store exists', async () => {
    const res = await request(app).get('/api/store/tax');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return null data when store exists but no tax config', async () => {
    // Create a store first
    await request(app).post('/api/store').send(validStoreInput);

    const res = await request(app).get('/api/store/tax');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('should return tax config when it exists', async () => {
    // Create store and tax config
    await request(app).post('/api/store').send(validStoreInput);
    await request(app).put('/api/store/tax').send({ dasRate: 6.5 });

    const res = await request(app).get('/api/store/tax');
    expect(res.status).toBe(200);
    expect(res.body.data).not.toBeNull();
    expect(res.body.data.dasRate).toBe(6.5);
    expect(res.body.data.icms).toBe(0);
    expect(res.body.data.pis).toBe(0);
    expect(res.body.data.cofins).toBe(0);
    expect(res.body.data.irpj).toBe(0);
    expect(res.body.data.csll).toBe(0);
  });
});

describe('PUT /api/store/tax', () => {
  it('should return 404 when no store exists', async () => {
    const res = await request(app).put('/api/store/tax').send({ dasRate: 5 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should create tax config for MEI with dasRate', async () => {
    await request(app).post('/api/store').send(validStoreInput);

    const res = await request(app).put('/api/store/tax').send({ dasRate: 6.0 });
    expect(res.status).toBe(200);
    expect(res.body.data.dasRate).toBe(6.0);
    expect(res.body.data.icms).toBe(0);
  });

  it('should create tax config for Lucro Presumido with individual rates', async () => {
    await request(app).post('/api/store').send({
      ...validStoreInput,
      taxRegime: 'LUCRO_PRESUMIDO',
    });

    const res = await request(app).put('/api/store/tax').send({
      icms: 18,
      pis: 1.65,
      cofins: 7.6,
      irpj: 15,
      csll: 9,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.icms).toBe(18);
    expect(res.body.data.pis).toBe(1.65);
    expect(res.body.data.cofins).toBe(7.6);
    expect(res.body.data.irpj).toBe(15);
    expect(res.body.data.csll).toBe(9);
    expect(res.body.data.dasRate).toBe(0);
  });

  it('should update existing tax config (upsert)', async () => {
    await request(app).post('/api/store').send(validStoreInput);

    // Create initial config
    await request(app).put('/api/store/tax').send({ dasRate: 5.0 });

    // Update it
    const res = await request(app).put('/api/store/tax').send({ dasRate: 7.5 });
    expect(res.status).toBe(200);
    expect(res.body.data.dasRate).toBe(7.5);
  });

  it('should return 400 for negative rate value', async () => {
    await request(app).post('/api/store').send(validStoreInput);

    const res = await request(app).put('/api/store/tax').send({ dasRate: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some((d: any) => d.field === 'dasRate')).toBe(true);
  });

  it('should return 400 for rate value above 100', async () => {
    await request(app).post('/api/store').send(validStoreInput);

    const res = await request(app).put('/api/store/tax').send({ icms: 101 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some((d: any) => d.field === 'icms')).toBe(true);
  });

  it('should return 400 for multiple invalid rates', async () => {
    await request(app).post('/api/store').send(validStoreInput);

    const res = await request(app).put('/api/store/tax').send({
      icms: -5,
      pis: 200,
      cofins: -0.1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBe(3);
  });

  it('should accept boundary values 0 and 100', async () => {
    await request(app).post('/api/store').send(validStoreInput);

    const res = await request(app).put('/api/store/tax').send({
      icms: 0,
      pis: 100,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.icms).toBe(0);
    expect(res.body.data.pis).toBe(100);
  });

  it('should default omitted fields to 0', async () => {
    await request(app).post('/api/store').send(validStoreInput);

    const res = await request(app).put('/api/store/tax').send({ dasRate: 6 });
    expect(res.status).toBe(200);
    expect(res.body.data.icms).toBe(0);
    expect(res.body.data.pis).toBe(0);
    expect(res.body.data.cofins).toBe(0);
    expect(res.body.data.irpj).toBe(0);
    expect(res.body.data.csll).toBe(0);
  });
});
