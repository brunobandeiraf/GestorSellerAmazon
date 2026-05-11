/**
 * Unit tests for product service and routes.
 * Tests the product CRUD operations and HTTP endpoints.
 */

import request from 'supertest';
import app, { prisma } from '../../src/server';

let storeId: string;

beforeAll(async () => {
  // Clean up and create a store for product tests
  await prisma.product.deleteMany();
  await prisma.integration.deleteMany();
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
  await prisma.product.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.store.deleteMany();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.product.deleteMany();
});

describe('GET /api/products', () => {
  it('should return empty array when no products exist', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should return all products for the store', async () => {
    await prisma.product.createMany({
      data: [
        {
          storeId,
          sku: 'SKU-001',
          asin: 'B000000001',
          title: 'Product 1',
          sellingPrice: 99.90,
        },
        {
          storeId,
          sku: 'SKU-002',
          asin: 'B000000002',
          title: 'Product 2',
          sellingPrice: 149.90,
        },
      ],
    });

    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('should return 404 if no store exists', async () => {
    // Remove the store temporarily
    await prisma.product.deleteMany();
    await prisma.integration.deleteMany();
    await prisma.store.deleteMany();

    const res = await request(app).get('/api/products');
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

describe('GET /api/products/:id', () => {
  it('should return a single product by ID', async () => {
    const product = await prisma.product.create({
      data: {
        storeId,
        sku: 'SKU-001',
        asin: 'B000000001',
        title: 'Product 1',
        sellingPrice: 99.90,
      },
    });

    const res = await request(app).get(`/api/products/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(product.id);
    expect(res.body.data.sku).toBe('SKU-001');
    expect(res.body.data.title).toBe('Product 1');
  });

  it('should return 404 for non-existent product', async () => {
    const res = await request(app).get('/api/products/non-existent-id');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PUT /api/products/:id/cost', () => {
  it('should update cost price with valid value', async () => {
    const product = await prisma.product.create({
      data: {
        storeId,
        sku: 'SKU-001',
        asin: 'B000000001',
        title: 'Product 1',
        sellingPrice: 99.90,
      },
    });

    const res = await request(app)
      .put(`/api/products/${product.id}/cost`)
      .send({ costPrice: 45.50 });

    expect(res.status).toBe(200);
    expect(res.body.data.costPrice).toBe(45.50);
    expect(res.body.data.id).toBe(product.id);
  });

  it('should return 400 for negative cost price', async () => {
    const product = await prisma.product.create({
      data: {
        storeId,
        sku: 'SKU-001',
        asin: 'B000000001',
        title: 'Product 1',
        sellingPrice: 99.90,
      },
    });

    const res = await request(app)
      .put(`/api/products/${product.id}/cost`)
      .send({ costPrice: -10 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for zero cost price', async () => {
    const product = await prisma.product.create({
      data: {
        storeId,
        sku: 'SKU-001',
        asin: 'B000000001',
        title: 'Product 1',
        sellingPrice: 99.90,
      },
    });

    const res = await request(app)
      .put(`/api/products/${product.id}/cost`)
      .send({ costPrice: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 for non-existent product', async () => {
    const res = await request(app)
      .put('/api/products/non-existent-id/cost')
      .send({ costPrice: 45.50 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return 404 if no store exists', async () => {
    // Remove the store temporarily
    await prisma.product.deleteMany();
    await prisma.integration.deleteMany();
    await prisma.store.deleteMany();

    const res = await request(app)
      .put('/api/products/some-id/cost')
      .send({ costPrice: 45.50 });

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
