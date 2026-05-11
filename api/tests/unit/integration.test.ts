/**
 * Unit tests for integration routes.
 * Tests the Amazon integration endpoints.
 */

import request from 'supertest';
import app, { prisma } from '../../src/server';

let storeId: string;

beforeAll(async () => {
  // Clean up and create a store for integration tests
  await prisma.syncJob.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();

  const store = await prisma.store.create({
    data: {
      name: 'Test Store',
      cnpj: '11222333000181',
      taxRegime: 'MEI',
    },
  });
  storeId = store.id;
});

afterAll(async () => {
  await prisma.syncJob.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.syncJob.deleteMany();
  await prisma.integration.deleteMany();
});

describe('POST /api/integration/connect', () => {
  it('should return 400 when credential fields are missing', async () => {
    const res = await request(app)
      .post('/api/integration/connect')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('obrigatórios');
  });

  it('should return 400 when some credential fields are empty strings', async () => {
    const res = await request(app)
      .post('/api/integration/connect')
      .send({
        clientId: 'test-client-id',
        clientSecret: '',
        refreshToken: 'test-refresh-token',
        awsAccessKeyId: 'test-key',
        awsSecretAccessKey: 'test-secret',
        roleArn: 'arn:aws:iam::123456789:role/test',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some((d: any) => d.field === 'clientSecret')).toBe(true);
  });

  it('should return 404 when no store exists', async () => {
    // Remove the store temporarily
    await prisma.integration.deleteMany();
    await prisma.product.deleteMany();
    await prisma.store.deleteMany();

    const res = await request(app)
      .post('/api/integration/connect')
      .send({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
        awsAccessKeyId: 'test-key',
        awsSecretAccessKey: 'test-secret',
        roleArn: 'arn:aws:iam::123456789:role/test',
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    // Recreate the store
    const store = await prisma.store.create({
      data: {
        name: 'Test Store',
        cnpj: '11222333000181',
        taxRegime: 'MEI',
      },
    });
    storeId = store.id;
  });
});

describe('GET /api/integration/status', () => {
  it('should return null when no integration exists', async () => {
    const res = await request(app).get('/api/integration/status');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('should return integration record when it exists', async () => {
    await prisma.integration.create({
      data: {
        storeId,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
        awsAccessKeyId: 'test-key',
        awsSecretAccessKey: 'test-secret',
        roleArn: 'arn:aws:iam::123456789:role/test',
        marketplaceId: 'A2Q3Y263D00KWC',
        status: 'ACTIVE',
      },
    });

    const res = await request(app).get('/api/integration/status');
    expect(res.status).toBe(200);
    expect(res.body.data).not.toBeNull();
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.storeId).toBe(storeId);
  });

  it('should return 404 when no store exists', async () => {
    await prisma.integration.deleteMany();
    await prisma.product.deleteMany();
    await prisma.store.deleteMany();

    const res = await request(app).get('/api/integration/status');
    expect(res.status).toBe(404);

    // Recreate the store
    const store = await prisma.store.create({
      data: {
        name: 'Test Store',
        cnpj: '11222333000181',
        taxRegime: 'MEI',
      },
    });
    storeId = store.id;
  });
});

describe('POST /api/integration/sync/products', () => {
  it('should return 404 when no integration exists', async () => {
    const res = await request(app).post('/api/integration/sync/products');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return 202 when integration exists', async () => {
    await prisma.integration.create({
      data: {
        storeId,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
        awsAccessKeyId: 'test-key',
        awsSecretAccessKey: 'test-secret',
        roleArn: 'arn:aws:iam::123456789:role/test',
        marketplaceId: 'A2Q3Y263D00KWC',
        status: 'ACTIVE',
      },
    });

    const res = await request(app).post('/api/integration/sync/products');
    expect(res.status).toBe(202);
    expect(res.body.message).toContain('Importação');
  });
});

describe('GET /api/integration/sync/progress', () => {
  it('should return null when no sync job exists', async () => {
    const res = await request(app).get('/api/integration/sync/progress');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('should return the latest sync job for PRODUCTS', async () => {
    await prisma.syncJob.create({
      data: {
        type: 'PRODUCTS',
        status: 'IN_PROGRESS',
        progress: 50,
        totalItems: 10,
        processedItems: 5,
      },
    });

    const res = await request(app).get('/api/integration/sync/progress');
    expect(res.status).toBe(200);
    expect(res.body.data).not.toBeNull();
    expect(res.body.data.type).toBe('PRODUCTS');
    expect(res.body.data.progress).toBe(50);
    expect(res.body.data.processedItems).toBe(5);
  });

  it('should return the most recent sync job', async () => {
    // Create an older job
    await prisma.syncJob.create({
      data: {
        type: 'PRODUCTS',
        status: 'COMPLETED',
        progress: 100,
        totalItems: 5,
        processedItems: 5,
        startedAt: new Date('2024-01-01'),
      },
    });

    // Create a newer job
    await prisma.syncJob.create({
      data: {
        type: 'PRODUCTS',
        status: 'IN_PROGRESS',
        progress: 25,
        totalItems: 20,
        processedItems: 5,
        startedAt: new Date('2024-06-01'),
      },
    });

    const res = await request(app).get('/api/integration/sync/progress');
    expect(res.status).toBe(200);
    expect(res.body.data.progress).toBe(25);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });
});
