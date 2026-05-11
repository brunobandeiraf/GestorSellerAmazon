/**
 * Unit tests for dashboard service and routes.
 * Tests the dashboard metrics endpoint with date filtering.
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
      name: 'Test Store Dashboard',
      cnpj: '11222333000181',
      taxRegime: 'MEI',
    },
  });
  storeId = store.id;

  // Create a product
  const product = await prisma.product.create({
    data: {
      storeId,
      sku: 'SKU-DASH-001',
      asin: 'B000DASH01',
      title: 'Dashboard Test Product',
      sellingPrice: 100,
      costPrice: 50,
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

describe('GET /api/dashboard', () => {
  beforeEach(async () => {
    await prisma.sale.deleteMany();
  });

  it('should return zero metrics when no sales exist', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      totalSales: 0,
      totalRevenue: 0,
      averageMargin: null,
      averageRoi: null,
    });
  });

  it('should return 404 when no store exists', async () => {
    // Temporarily remove the store
    await prisma.sale.deleteMany();
    await prisma.product.deleteMany();
    await prisma.store.deleteMany();

    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(404);

    // Recreate the store and product for subsequent tests
    const store = await prisma.store.create({
      data: {
        id: storeId,
        name: 'Test Store Dashboard',
        cnpj: '11222333000181',
        taxRegime: 'MEI',
      },
    });
    storeId = store.id;

    const product = await prisma.product.create({
      data: {
        id: productId,
        storeId,
        sku: 'SKU-DASH-001',
        asin: 'B000DASH01',
        title: 'Dashboard Test Product',
        sellingPrice: 100,
        costPrice: 50,
      },
    });
    productId = product.id;
  });

  it('should calculate metrics correctly for sales in date range', async () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Create sales for today
    await prisma.sale.createMany({
      data: [
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-DASH-001',
          orderDate: new Date(todayStr + 'T10:00:00.000Z'),
          quantity: 2,
          sellingPrice: 100,
          totalAmount: 200,
          amazonFee: 30,
          taxAmount: 12,
          costPrice: 50,
          netProfit: 58,
          margin: 29,
          roi: 58,
          orderStatus: 'Shipped',
        },
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-DASH-002',
          orderDate: new Date(todayStr + 'T14:00:00.000Z'),
          quantity: 1,
          sellingPrice: 100,
          totalAmount: 100,
          amazonFee: 15,
          taxAmount: 6,
          costPrice: 50,
          netProfit: 29,
          margin: 29,
          roi: 58,
          orderStatus: 'Shipped',
        },
      ],
    });

    const res = await request(app)
      .get('/api/dashboard')
      .query({ startDate: todayStr, endDate: todayStr });

    expect(res.status).toBe(200);
    expect(res.body.data.totalSales).toBe(2);
    expect(res.body.data.totalRevenue).toBe(300);
    expect(res.body.data.averageMargin).toBe(29);
    expect(res.body.data.averageRoi).toBe(58);
  });

  it('should handle sales with null margin and roi', async () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    await prisma.sale.createMany({
      data: [
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-DASH-003',
          orderDate: new Date(todayStr + 'T10:00:00.000Z'),
          quantity: 1,
          sellingPrice: 100,
          totalAmount: 100,
          amazonFee: 15,
          taxAmount: 6,
          margin: null,
          roi: null,
          orderStatus: 'Shipped',
        },
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-DASH-004',
          orderDate: new Date(todayStr + 'T12:00:00.000Z'),
          quantity: 1,
          sellingPrice: 100,
          totalAmount: 100,
          amazonFee: 15,
          taxAmount: 6,
          costPrice: 50,
          netProfit: 29,
          margin: 29,
          roi: 58,
          orderStatus: 'Shipped',
        },
      ],
    });

    const res = await request(app)
      .get('/api/dashboard')
      .query({ startDate: todayStr, endDate: todayStr });

    expect(res.status).toBe(200);
    expect(res.body.data.totalSales).toBe(2);
    expect(res.body.data.totalRevenue).toBe(200);
    // Only one sale has margin/roi, so average = that sale's value
    expect(res.body.data.averageMargin).toBe(29);
    expect(res.body.data.averageRoi).toBe(58);
  });

  it('should filter by date range correctly', async () => {
    // Create sales on different dates
    await prisma.sale.createMany({
      data: [
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-DASH-005',
          orderDate: new Date('2024-01-15T10:00:00.000Z'),
          quantity: 1,
          sellingPrice: 100,
          totalAmount: 100,
          amazonFee: 15,
          taxAmount: 6,
          margin: 20,
          roi: 40,
          orderStatus: 'Shipped',
        },
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-DASH-006',
          orderDate: new Date('2024-01-20T10:00:00.000Z'),
          quantity: 1,
          sellingPrice: 100,
          totalAmount: 150,
          amazonFee: 22,
          taxAmount: 9,
          margin: 30,
          roi: 60,
          orderStatus: 'Shipped',
        },
        {
          storeId,
          productId,
          amazonOrderId: 'ORDER-DASH-007',
          orderDate: new Date('2024-02-01T10:00:00.000Z'),
          quantity: 1,
          sellingPrice: 100,
          totalAmount: 200,
          amazonFee: 30,
          taxAmount: 12,
          margin: 25,
          roi: 50,
          orderStatus: 'Shipped',
        },
      ],
    });

    // Filter for January only
    const res = await request(app)
      .get('/api/dashboard')
      .query({ startDate: '2024-01-01', endDate: '2024-01-31' });

    expect(res.status).toBe(200);
    expect(res.body.data.totalSales).toBe(2);
    expect(res.body.data.totalRevenue).toBe(250);
    expect(res.body.data.averageMargin).toBe(25);
    expect(res.body.data.averageRoi).toBe(50);
  });
});
