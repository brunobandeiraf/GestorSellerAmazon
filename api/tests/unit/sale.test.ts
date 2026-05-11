/**
 * Unit tests for sale service and routes.
 * Tests the sales listing and retrieval endpoints with date filtering.
 */

import request from 'supertest';
import app, { prisma } from '../../src/server';

let storeId: string;
let productId: string;

beforeAll(async () => {
  // Clean up
  await prisma.sale.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();

  // Create a store
  const store = await prisma.store.create({
    data: {
      name: 'Test Store Sales',
      cnpj: '53113791000122',
      taxRegime: 'SIMPLES_NACIONAL',
    },
  });
  storeId = store.id;

  // Create a product
  const product = await prisma.product.create({
    data: {
      storeId,
      sku: 'SKU-SALE-001',
      asin: 'B000SALE01',
      title: 'Sale Test Product',
      imageUrl: 'https://example.com/image.jpg',
      sellingPrice: 80,
      costPrice: 30,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.sale.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.$disconnect();
});

describe('GET /api/sales', () => {
  beforeEach(async () => {
    await prisma.sale.deleteMany();
  });

  it('should return empty array when no sales exist', async () => {
    const res = await request(app).get('/api/sales');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should return 404 when no store exists', async () => {
    await prisma.sale.deleteMany();
    await prisma.product.deleteMany();
    await prisma.store.deleteMany();

    const res = await request(app).get('/api/sales');
    expect(res.status).toBe(404);

    // Recreate store and product
    const store = await prisma.store.create({
      data: {
        id: storeId,
        name: 'Test Store Sales',
        cnpj: '53113791000122',
        taxRegime: 'SIMPLES_NACIONAL',
      },
    });
    storeId = store.id;

    const product = await prisma.product.create({
      data: {
        id: productId,
        storeId,
        sku: 'SKU-SALE-001',
        asin: 'B000SALE01',
        title: 'Sale Test Product',
        imageUrl: 'https://example.com/image.jpg',
        sellingPrice: 80,
        costPrice: 30,
      },
    });
    productId = product.id;
  });

  it('should list sales with product info', async () => {
    await prisma.sale.create({
      data: {
        storeId,
        productId,
        amazonOrderId: 'ORDER-SALE-001',
        orderDate: new Date('2024-03-15T10:00:00.000Z'),
        quantity: 2,
        sellingPrice: 80,
        totalAmount: 160,
        amazonFee: 24,
        taxAmount: 9.6,
        costPrice: 30,
        netProfit: 36.4,
        margin: 22.75,
        roi: 60.67,
        orderStatus: 'Shipped',
      },
    });

    const res = await request(app).get('/api/sales');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].amazonOrderId).toBe('ORDER-SALE-001');
    expect(res.body.data[0].product).toEqual({
      title: 'Sale Test Product',
      sku: 'SKU-SALE-001',
      imageUrl: 'https://example.com/image.jpg',
    });
  });

  it('should order sales by orderDate descending', async () => {
    await prisma.sale.createMany({
      data: [
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-SALE-002',
          orderDate: new Date('2024-03-10T10:00:00.000Z'),
          quantity: 1,
          sellingPrice: 80,
          totalAmount: 80,
          amazonFee: 12,
          taxAmount: 4.8,
          orderStatus: 'Shipped',
        },
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-SALE-003',
          orderDate: new Date('2024-03-20T10:00:00.000Z'),
          quantity: 1,
          sellingPrice: 80,
          totalAmount: 80,
          amazonFee: 12,
          taxAmount: 4.8,
          orderStatus: 'Shipped',
        },
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-SALE-004',
          orderDate: new Date('2024-03-15T10:00:00.000Z'),
          quantity: 1,
          sellingPrice: 80,
          totalAmount: 80,
          amazonFee: 12,
          taxAmount: 4.8,
          orderStatus: 'Shipped',
        },
      ],
    });

    const res = await request(app).get('/api/sales');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    // Should be ordered: March 20, March 15, March 10
    expect(res.body.data[0].amazonOrderId).toBe('ORDER-SALE-003');
    expect(res.body.data[1].amazonOrderId).toBe('ORDER-SALE-004');
    expect(res.body.data[2].amazonOrderId).toBe('ORDER-SALE-002');
  });

  it('should filter by date range (inclusive)', async () => {
    await prisma.sale.createMany({
      data: [
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-SALE-005',
          orderDate: new Date('2024-03-01T00:00:00.000Z'),
          quantity: 1,
          sellingPrice: 80,
          totalAmount: 80,
          amazonFee: 12,
          taxAmount: 4.8,
          orderStatus: 'Shipped',
        },
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-SALE-006',
          orderDate: new Date('2024-03-15T12:00:00.000Z'),
          quantity: 1,
          sellingPrice: 80,
          totalAmount: 80,
          amazonFee: 12,
          taxAmount: 4.8,
          orderStatus: 'Shipped',
        },
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-SALE-007',
          orderDate: new Date('2024-03-31T23:59:59.000Z'),
          quantity: 1,
          sellingPrice: 80,
          totalAmount: 80,
          amazonFee: 12,
          taxAmount: 4.8,
          orderStatus: 'Shipped',
        },
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-SALE-008',
          orderDate: new Date('2024-04-01T00:00:00.000Z'),
          quantity: 1,
          sellingPrice: 80,
          totalAmount: 80,
          amazonFee: 12,
          taxAmount: 4.8,
          orderStatus: 'Shipped',
        },
      ],
    });

    const res = await request(app)
      .get('/api/sales')
      .query({ startDate: '2024-03-01', endDate: '2024-03-31' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    // Should not include the April sale
    const orderIds = res.body.data.map((s: any) => s.amazonOrderId);
    expect(orderIds).toContain('ORDER-SALE-005');
    expect(orderIds).toContain('ORDER-SALE-006');
    expect(orderIds).toContain('ORDER-SALE-007');
    expect(orderIds).not.toContain('ORDER-SALE-008');
  });

  it('should filter with only startDate', async () => {
    await prisma.sale.createMany({
      data: [
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-SALE-009',
          orderDate: new Date('2024-02-28T10:00:00.000Z'),
          quantity: 1,
          sellingPrice: 80,
          totalAmount: 80,
          amazonFee: 12,
          taxAmount: 4.8,
          orderStatus: 'Shipped',
        },
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-SALE-010',
          orderDate: new Date('2024-03-15T10:00:00.000Z'),
          quantity: 1,
          sellingPrice: 80,
          totalAmount: 80,
          amazonFee: 12,
          taxAmount: 4.8,
          orderStatus: 'Shipped',
        },
      ],
    });

    const res = await request(app)
      .get('/api/sales')
      .query({ startDate: '2024-03-01' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].amazonOrderId).toBe('ORDER-SALE-010');
  });
});

describe('GET /api/sales/:id', () => {
  let saleId: string;

  beforeAll(async () => {
    await prisma.sale.deleteMany();
    const sale = await prisma.sale.create({
      data: {
        storeId,
        productId,
        amazonOrderId: 'ORDER-SALE-GET-001',
        orderDate: new Date('2024-03-15T10:00:00.000Z'),
        quantity: 3,
        sellingPrice: 80,
        totalAmount: 240,
        amazonFee: 36,
        taxAmount: 14.4,
        costPrice: 30,
        netProfit: 69.6,
        margin: 29,
        roi: 77.33,
        orderStatus: 'Shipped',
      },
    });
    saleId = sale.id;
  });

  it('should return a single sale with product info', async () => {
    const res = await request(app).get(`/api/sales/${saleId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(saleId);
    expect(res.body.data.amazonOrderId).toBe('ORDER-SALE-GET-001');
    expect(res.body.data.quantity).toBe(3);
    expect(res.body.data.product).toEqual({
      title: 'Sale Test Product',
      sku: 'SKU-SALE-001',
      imageUrl: 'https://example.com/image.jpg',
    });
  });

  it('should return 404 for non-existent sale', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/sales/${fakeId}`);
    expect(res.status).toBe(404);
  });
});
