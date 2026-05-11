/**
 * Integration routes - REST endpoints for Amazon SP-API integration management.
 * POST /api/integration/connect - Saves credentials and tests connection
 * GET  /api/integration/status - Returns integration status
 * POST /api/integration/sync/products - Triggers product import (background)
 * POST /api/integration/sync/sales - Triggers historical sales import (background)
 * GET  /api/integration/sync/progress - Returns latest sync job progress (supports ?type=PRODUCTS|SALES_HISTORY)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { testConnection, importProducts, importHistoricalSales, AmazonCredentials } from '../services/amazon.service';
import { ValidationError, NotFoundError } from '../utils/errors';

const router = Router();

/**
 * Wraps an async route handler to forward errors to Express error middleware.
 */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * POST /api/integration/connect
 * Saves credentials to Integration model, tests connection,
 * updates status to ACTIVE on success or ERROR on failure.
 */
router.post(
  '/integration/connect',
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId, clientSecret, refreshToken, awsAccessKeyId, awsSecretAccessKey, roleArn, marketplaceId } = req.body;

    // Validate all credential fields are present
    const requiredFields = [
      { field: 'clientId', value: clientId },
      { field: 'clientSecret', value: clientSecret },
      { field: 'refreshToken', value: refreshToken },
      { field: 'awsAccessKeyId', value: awsAccessKeyId },
      { field: 'awsSecretAccessKey', value: awsSecretAccessKey },
      { field: 'roleArn', value: roleArn },
    ];

    const missingFields = requiredFields.filter(f => !f.value || (typeof f.value === 'string' && f.value.trim() === ''));
    if (missingFields.length > 0) {
      throw new ValidationError('Todos os campos de credenciais são obrigatórios', missingFields.map(f => ({
        field: f.field,
        message: `${f.field} é obrigatório`,
      })));
    }

    // Ensure store exists
    const store = await prisma.store.findFirst();
    if (!store) {
      throw new NotFoundError('Loja não encontrada. Cadastre a loja primeiro.');
    }

    const credentials: AmazonCredentials = {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      refreshToken: refreshToken.trim(),
      awsAccessKeyId: awsAccessKeyId.trim(),
      awsSecretAccessKey: awsSecretAccessKey.trim(),
      roleArn: roleArn.trim(),
      marketplaceId: marketplaceId?.trim() || 'A2Q3Y263D00KWC',
    };

    // Upsert integration record
    const integration = await prisma.integration.upsert({
      where: { storeId: store.id },
      create: {
        storeId: store.id,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        refreshToken: credentials.refreshToken,
        awsAccessKeyId: credentials.awsAccessKeyId,
        awsSecretAccessKey: credentials.awsSecretAccessKey,
        roleArn: credentials.roleArn,
        marketplaceId: credentials.marketplaceId,
        status: 'PENDING',
      },
      update: {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        refreshToken: credentials.refreshToken,
        awsAccessKeyId: credentials.awsAccessKeyId,
        awsSecretAccessKey: credentials.awsSecretAccessKey,
        roleArn: credentials.roleArn,
        marketplaceId: credentials.marketplaceId,
        status: 'PENDING',
        lastError: null,
      },
    });

    // Test connection
    try {
      await testConnection(credentials);

      // Update status to ACTIVE on success
      const updatedIntegration = await prisma.integration.update({
        where: { id: integration.id },
        data: { status: 'ACTIVE', lastError: null },
      });

      // Automatically trigger historical sales import after first successful connection
      importHistoricalSales(credentials, store.id).catch((error) => {
        console.error('Background historical sales import failed:', error?.message);
      });

      res.json({ data: updatedIntegration });
    } catch (error: any) {
      // Update status to ERROR on failure
      const updatedIntegration = await prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: 'ERROR',
          lastError: error?.message || 'Falha ao conectar com a Amazon',
        },
      });

      res.json({ data: updatedIntegration });
    }
  })
);

/**
 * GET /api/integration/status
 * Returns the integration record (status, lastSyncAt, lastError).
 */
router.get(
  '/integration/status',
  asyncHandler(async (_req: Request, res: Response) => {
    // Ensure store exists
    const store = await prisma.store.findFirst();
    if (!store) {
      throw new NotFoundError('Loja não encontrada. Cadastre a loja primeiro.');
    }

    const integration = await prisma.integration.findUnique({
      where: { storeId: store.id },
    });

    res.json({ data: integration || null });
  })
);

/**
 * POST /api/integration/sync/products
 * Triggers product import in background (don't await).
 * Returns 202 Accepted immediately.
 */
router.post(
  '/integration/sync/products',
  asyncHandler(async (_req: Request, res: Response) => {
    // Ensure store exists
    const store = await prisma.store.findFirst();
    if (!store) {
      throw new NotFoundError('Loja não encontrada. Cadastre a loja primeiro.');
    }

    const integration = await prisma.integration.findUnique({
      where: { storeId: store.id },
    });

    if (!integration) {
      throw new NotFoundError('Integração não configurada. Conecte sua conta Amazon primeiro.');
    }

    const credentials: AmazonCredentials = {
      clientId: integration.clientId,
      clientSecret: integration.clientSecret,
      refreshToken: integration.refreshToken,
      awsAccessKeyId: integration.awsAccessKeyId,
      awsSecretAccessKey: integration.awsSecretAccessKey,
      roleArn: integration.roleArn,
      marketplaceId: integration.marketplaceId,
    };

    // Trigger import in background (don't await)
    importProducts(credentials, store.id).catch((error) => {
      console.error('Background product import failed:', error?.message);
    });

    res.status(202).json({ message: 'Importação de produtos iniciada' });
  })
);

/**
 * GET /api/integration/sync/progress
 * Returns the latest SyncJob for the specified type.
 * Accepts query param ?type=PRODUCTS|SALES_HISTORY (defaults to PRODUCTS).
 */
router.get(
  '/integration/sync/progress',
  asyncHandler(async (req: Request, res: Response) => {
    // Ensure store exists
    const store = await prisma.store.findFirst();
    if (!store) {
      throw new NotFoundError('Loja não encontrada. Cadastre a loja primeiro.');
    }

    const syncType = (req.query.type as string) || 'PRODUCTS';
    const validTypes = ['PRODUCTS', 'SALES_HISTORY', 'SALES_RECENT'];
    const type = validTypes.includes(syncType) ? syncType : 'PRODUCTS';

    const syncJob = await prisma.syncJob.findFirst({
      where: { type: type as any },
      orderBy: { startedAt: 'desc' },
    });

    res.json({ data: syncJob || null });
  })
);

/**
 * POST /api/integration/sync/sales
 * Triggers historical sales import in background (don't await).
 * Returns 202 Accepted immediately.
 */
router.post(
  '/integration/sync/sales',
  asyncHandler(async (_req: Request, res: Response) => {
    // Ensure store exists
    const store = await prisma.store.findFirst();
    if (!store) {
      throw new NotFoundError('Loja não encontrada. Cadastre a loja primeiro.');
    }

    const integration = await prisma.integration.findUnique({
      where: { storeId: store.id },
    });

    if (!integration) {
      throw new NotFoundError('Integração não configurada. Conecte sua conta Amazon primeiro.');
    }

    if (integration.status !== 'ACTIVE') {
      throw new ValidationError('Integração não está ativa. Conecte sua conta Amazon primeiro.');
    }

    const credentials: AmazonCredentials = {
      clientId: integration.clientId,
      clientSecret: integration.clientSecret,
      refreshToken: integration.refreshToken,
      awsAccessKeyId: integration.awsAccessKeyId,
      awsSecretAccessKey: integration.awsSecretAccessKey,
      roleArn: integration.roleArn,
      marketplaceId: integration.marketplaceId,
    };

    // Trigger import in background (don't await)
    importHistoricalSales(credentials, store.id).catch((error) => {
      console.error('Background historical sales import failed:', error?.message);
    });

    res.status(202).json({ message: 'Importação de vendas históricas iniciada' });
  })
);

export default router;
