/**
 * Unit tests for sync.job.ts
 * Tests the syncRecentSales function and startSyncJob initialization.
 */

import { syncRecentSales, startSyncJob } from '../../src/jobs/sync.job';

// Mock node-cron
const mockSchedule = jest.fn().mockReturnValue({ stop: jest.fn() });
jest.mock('node-cron', () => ({
  schedule: (...args: any[]) => mockSchedule(...args),
}));

// Mock amazon-sp-api
const mockCallAPI = jest.fn();
jest.mock('amazon-sp-api', () => ({
  SellingPartner: jest.fn().mockImplementation(() => ({
    callAPI: mockCallAPI,
  })),
}));

// Mock prisma
const mockPrisma = {
  integration: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  syncJob: {
    create: jest.fn(),
    update: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
  },
  sale: {
    upsert: jest.fn(),
  },
};

jest.mock('../../src/server', () => ({
  prisma: {
    integration: {
      findFirst: (...args: any[]) => mockPrisma.integration.findFirst(...args),
      update: (...args: any[]) => mockPrisma.integration.update(...args),
    },
    syncJob: {
      create: (...args: any[]) => mockPrisma.syncJob.create(...args),
      update: (...args: any[]) => mockPrisma.syncJob.update(...args),
    },
    product: {
      findFirst: (...args: any[]) => mockPrisma.product.findFirst(...args),
    },
    sale: {
      upsert: (...args: any[]) => mockPrisma.sale.upsert(...args),
    },
  },
}));

describe('sync.job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('syncRecentSales', () => {
    it('should skip silently when no active integration exists', async () => {
      mockPrisma.integration.findFirst.mockResolvedValue(null);

      await syncRecentSales();

      expect(mockPrisma.syncJob.create).not.toHaveBeenCalled();
      expect(mockCallAPI).not.toHaveBeenCalled();
    });

    it('should create a SyncJob with type SALES_RECENT', async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: 'int-1',
        storeId: 'store-1',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
        awsAccessKeyId: 'aws-key',
        awsSecretAccessKey: 'aws-secret',
        roleArn: 'role-arn',
        marketplaceId: 'A2Q3Y263D00KWC',
        status: 'ACTIVE',
        store: {
          id: 'store-1',
          taxRegime: 'SIMPLES_NACIONAL',
          taxConfig: {
            icms: 0,
            pis: 0,
            cofins: 0,
            irpj: 0,
            csll: 0,
            dasRate: 6,
          },
        },
      });

      mockPrisma.syncJob.create.mockResolvedValue({ id: 'job-1' });
      mockCallAPI.mockResolvedValue({ Orders: [] });
      mockPrisma.syncJob.update.mockResolvedValue({});
      mockPrisma.integration.update.mockResolvedValue({});

      await syncRecentSales();

      expect(mockPrisma.syncJob.create).toHaveBeenCalledWith({
        data: {
          type: 'SALES_RECENT',
          status: 'IN_PROGRESS',
          progress: 0,
          processedItems: 0,
        },
      });
    });

    it('should fetch orders from the last 6 hours', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockPrisma.integration.findFirst.mockResolvedValue({
        id: 'int-1',
        storeId: 'store-1',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
        awsAccessKeyId: 'aws-key',
        awsSecretAccessKey: 'aws-secret',
        roleArn: 'role-arn',
        marketplaceId: 'A2Q3Y263D00KWC',
        status: 'ACTIVE',
        store: {
          id: 'store-1',
          taxRegime: 'MEI',
          taxConfig: { icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, dasRate: 5 },
        },
      });

      mockPrisma.syncJob.create.mockResolvedValue({ id: 'job-1' });
      mockCallAPI.mockResolvedValue({ Orders: [] });
      mockPrisma.syncJob.update.mockResolvedValue({});
      mockPrisma.integration.update.mockResolvedValue({});

      await syncRecentSales();

      expect(mockCallAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'getOrders',
          query: expect.objectContaining({
            MarketplaceIds: ['A2Q3Y263D00KWC'],
            CreatedAfter: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
          }),
        })
      );

      jest.restoreAllMocks();
    });

    it('should process orders and upsert sales', async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: 'int-1',
        storeId: 'store-1',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
        awsAccessKeyId: 'aws-key',
        awsSecretAccessKey: 'aws-secret',
        roleArn: 'role-arn',
        marketplaceId: 'A2Q3Y263D00KWC',
        status: 'ACTIVE',
        store: {
          id: 'store-1',
          taxRegime: 'SIMPLES_NACIONAL',
          taxConfig: { icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, dasRate: 6 },
        },
      });

      mockPrisma.syncJob.create.mockResolvedValue({ id: 'job-1' });
      mockPrisma.syncJob.update.mockResolvedValue({});
      mockPrisma.integration.update.mockResolvedValue({});

      // Mock getOrders response
      mockCallAPI
        .mockResolvedValueOnce({
          Orders: [
            {
              AmazonOrderId: 'ORDER-001',
              PurchaseDate: '2024-01-15T10:00:00Z',
              OrderStatus: 'Shipped',
            },
          ],
        })
        // Mock getOrderItems response
        .mockResolvedValueOnce({
          OrderItems: [
            {
              SellerSKU: 'SKU-001',
              QuantityOrdered: 2,
              ItemPrice: { Amount: '100.00' },
            },
          ],
        });

      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        storeId: 'store-1',
        sku: 'SKU-001',
        sellingPrice: 50,
        costPrice: 20,
      });

      mockPrisma.sale.upsert.mockResolvedValue({});

      await syncRecentSales();

      expect(mockPrisma.sale.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { amazonOrderId: 'ORDER-001' },
          create: expect.objectContaining({
            storeId: 'store-1',
            productId: 'prod-1',
            amazonOrderId: 'ORDER-001',
            quantity: 2,
            orderStatus: 'Shipped',
          }),
        })
      );
    });

    it('should update lastSyncAt on the integration after success', async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: 'int-1',
        storeId: 'store-1',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
        awsAccessKeyId: 'aws-key',
        awsSecretAccessKey: 'aws-secret',
        roleArn: 'role-arn',
        marketplaceId: 'A2Q3Y263D00KWC',
        status: 'ACTIVE',
        store: {
          id: 'store-1',
          taxRegime: 'MEI',
          taxConfig: { icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, dasRate: 5 },
        },
      });

      mockPrisma.syncJob.create.mockResolvedValue({ id: 'job-1' });
      mockCallAPI.mockResolvedValue({ Orders: [] });
      mockPrisma.syncJob.update.mockResolvedValue({});
      mockPrisma.integration.update.mockResolvedValue({});

      await syncRecentSales();

      expect(mockPrisma.integration.update).toHaveBeenCalledWith({
        where: { id: 'int-1' },
        data: { lastSyncAt: expect.any(Date) },
      });
    });

    it('should mark SyncJob as COMPLETED after successful sync', async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: 'int-1',
        storeId: 'store-1',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
        awsAccessKeyId: 'aws-key',
        awsSecretAccessKey: 'aws-secret',
        roleArn: 'role-arn',
        marketplaceId: 'A2Q3Y263D00KWC',
        status: 'ACTIVE',
        store: {
          id: 'store-1',
          taxRegime: 'MEI',
          taxConfig: { icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, dasRate: 5 },
        },
      });

      mockPrisma.syncJob.create.mockResolvedValue({ id: 'job-1' });
      mockCallAPI.mockResolvedValue({ Orders: [] });
      mockPrisma.syncJob.update.mockResolvedValue({});
      mockPrisma.integration.update.mockResolvedValue({});

      await syncRecentSales();

      // Last syncJob update should mark as COMPLETED
      const lastCall = mockPrisma.syncJob.update.mock.calls[
        mockPrisma.syncJob.update.mock.calls.length - 1
      ];
      expect(lastCall[0]).toEqual(
        expect.objectContaining({
          where: { id: 'job-1' },
          data: expect.objectContaining({
            status: 'COMPLETED',
            progress: 100,
            completedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should mark SyncJob as FAILED on error', async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: 'int-1',
        storeId: 'store-1',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
        awsAccessKeyId: 'aws-key',
        awsSecretAccessKey: 'aws-secret',
        roleArn: 'role-arn',
        marketplaceId: 'A2Q3Y263D00KWC',
        status: 'ACTIVE',
        store: {
          id: 'store-1',
          taxRegime: 'MEI',
          taxConfig: { icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, dasRate: 5 },
        },
      });

      mockPrisma.syncJob.create.mockResolvedValue({ id: 'job-1' });
      mockCallAPI.mockRejectedValue(new Error('API connection failed'));
      mockPrisma.syncJob.update.mockResolvedValue({});

      await syncRecentSales();

      expect(mockPrisma.syncJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-1' },
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: 'API connection failed',
          }),
        })
      );
    });

    it('should skip items when product is not found by SKU', async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: 'int-1',
        storeId: 'store-1',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
        awsAccessKeyId: 'aws-key',
        awsSecretAccessKey: 'aws-secret',
        roleArn: 'role-arn',
        marketplaceId: 'A2Q3Y263D00KWC',
        status: 'ACTIVE',
        store: {
          id: 'store-1',
          taxRegime: 'MEI',
          taxConfig: { icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, dasRate: 5 },
        },
      });

      mockPrisma.syncJob.create.mockResolvedValue({ id: 'job-1' });
      mockPrisma.syncJob.update.mockResolvedValue({});
      mockPrisma.integration.update.mockResolvedValue({});

      mockCallAPI
        .mockResolvedValueOnce({
          Orders: [{ AmazonOrderId: 'ORDER-002', PurchaseDate: '2024-01-15T10:00:00Z', OrderStatus: 'Shipped' }],
        })
        .mockResolvedValueOnce({
          OrderItems: [{ SellerSKU: 'UNKNOWN-SKU', QuantityOrdered: 1, ItemPrice: { Amount: '50.00' } }],
        });

      mockPrisma.product.findFirst.mockResolvedValue(null);

      await syncRecentSales();

      expect(mockPrisma.sale.upsert).not.toHaveBeenCalled();
    });

    it('should calculate metrics with null values when costPrice is not set', async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: 'int-1',
        storeId: 'store-1',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
        awsAccessKeyId: 'aws-key',
        awsSecretAccessKey: 'aws-secret',
        roleArn: 'role-arn',
        marketplaceId: 'A2Q3Y263D00KWC',
        status: 'ACTIVE',
        store: {
          id: 'store-1',
          taxRegime: 'MEI',
          taxConfig: { icms: 0, pis: 0, cofins: 0, irpj: 0, csll: 0, dasRate: 5 },
        },
      });

      mockPrisma.syncJob.create.mockResolvedValue({ id: 'job-1' });
      mockPrisma.syncJob.update.mockResolvedValue({});
      mockPrisma.integration.update.mockResolvedValue({});

      mockCallAPI
        .mockResolvedValueOnce({
          Orders: [{ AmazonOrderId: 'ORDER-003', PurchaseDate: '2024-01-15T10:00:00Z', OrderStatus: 'Shipped' }],
        })
        .mockResolvedValueOnce({
          OrderItems: [{ SellerSKU: 'SKU-002', QuantityOrdered: 1, ItemPrice: { Amount: '80.00' } }],
        });

      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'prod-2',
        storeId: 'store-1',
        sku: 'SKU-002',
        sellingPrice: 80,
        costPrice: null,
      });

      mockPrisma.sale.upsert.mockResolvedValue({});

      await syncRecentSales();

      expect(mockPrisma.sale.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            netProfit: null,
            margin: null,
            roi: null,
            costPrice: null,
          }),
        })
      );
    });
  });

  describe('startSyncJob', () => {
    it('should schedule a cron job with 5-minute interval', () => {
      startSyncJob();

      expect(mockSchedule).toHaveBeenCalledWith(
        '*/5 * * * *',
        expect.any(Function)
      );
    });

    it('should return the scheduled task', () => {
      const task = startSyncJob();

      expect(task).toBeDefined();
      expect(task.stop).toBeDefined();
    });
  });
});
