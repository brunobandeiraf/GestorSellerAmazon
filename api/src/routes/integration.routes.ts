/**
 * Integration routes - REST endpoints for Amazon SP-API integration management.
 * GET  /api/integration/auth-url - Returns the Amazon OAuth authorization URL
 * GET  /api/integration/callback - OAuth callback from Amazon (exchanges code for refresh token)
 * POST /api/integration/connect - Saves credentials manually (legacy)
 * GET  /api/integration/status - Returns integration status
 * POST /api/integration/sync/products - Triggers product import (background)
 * POST /api/integration/sync/sales - Triggers historical sales import (background)
 * GET  /api/integration/sync/progress - Returns latest sync job progress
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { testConnection, importProducts, importHistoricalSales, AmazonCredentials } from '../services/amazon.service';
import { ValidationError, NotFoundError } from '../utils/errors';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// SP-API OAuth config from environment
const SP_API_CLIENT_ID = process.env.SP_API_CLIENT_ID || '';
const SP_API_CLIENT_SECRET = process.env.SP_API_CLIENT_SECRET || '';
const SP_API_APP_ID = process.env.SP_API_APP_ID || '';
const SP_API_REDIRECT_URI = process.env.SP_API_REDIRECT_URI || 'http://localhost:3001/api/integration/callback';
const SP_API_MARKETPLACE_ID = process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC';

/**
 * GET /api/integration/auth-url
 * Returns the Amazon OAuth authorization URL.
 * The user clicks this to authorize the app on Amazon.
 */
router.get(
  '/integration/auth-url',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!SP_API_CLIENT_ID) {
      throw new ValidationError('SP_API_CLIENT_ID não configurado no servidor.');
    }

    // Amazon SP-API OAuth URL for seller authorization
    // Uses APP_ID for the authorization URL (different from Client ID)
    const appId = SP_API_APP_ID || SP_API_CLIENT_ID;
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `https://sellercentral.amazon.com.br/apps/authorize/consent?application_id=${appId}&state=${state}&redirect_uri=${encodeURIComponent(SP_API_REDIRECT_URI)}`;

    res.json({ data: { authUrl, state } });
  })
);

/**
 * GET /api/integration/callback
 * OAuth callback from Amazon after user authorizes.
 * Receives spapi_oauth_code and exchanges it for a refresh_token.
 * Then redirects the user back to the frontend integration page.
 */
router.get(
  '/integration/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { spapi_oauth_code, selling_partner_id } = req.query;

    if (!spapi_oauth_code) {
      // Redirect to frontend with error
      res.redirect('http://localhost:3000/integration?error=no_code');
      return;
    }

    try {
      // Exchange the authorization code for a refresh token
      const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: spapi_oauth_code as string,
          redirect_uri: SP_API_REDIRECT_URI,
          client_id: SP_API_CLIENT_ID,
          client_secret: SP_API_CLIENT_SECRET,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.refresh_token) {
        console.error('Token exchange failed:', tokenData);
        res.redirect('http://localhost:3000/integration?error=token_exchange_failed');
        return;
      }

      const refreshToken = tokenData.refresh_token;

      // Ensure store exists
      const store = await prisma.store.findFirst();
      if (!store) {
        res.redirect('http://localhost:3000/integration?error=no_store');
        return;
      }

      // Save integration with the obtained refresh token
      await prisma.integration.upsert({
        where: { storeId: store.id },
        create: {
          storeId: store.id,
          clientId: SP_API_CLIENT_ID,
          clientSecret: SP_API_CLIENT_SECRET,
          refreshToken,
          awsAccessKeyId: process.env.SP_API_AWS_ACCESS_KEY || '',
          awsSecretAccessKey: process.env.SP_API_AWS_SECRET_KEY || '',
          roleArn: process.env.SP_API_ROLE_ARN || '',
          marketplaceId: SP_API_MARKETPLACE_ID,
          status: 'ACTIVE',
        },
        update: {
          clientId: SP_API_CLIENT_ID,
          clientSecret: SP_API_CLIENT_SECRET,
          refreshToken,
          awsAccessKeyId: process.env.SP_API_AWS_ACCESS_KEY || '',
          awsSecretAccessKey: process.env.SP_API_AWS_SECRET_KEY || '',
          roleArn: process.env.SP_API_ROLE_ARN || '',
          marketplaceId: SP_API_MARKETPLACE_ID,
          status: 'ACTIVE',
          lastError: null,
        },
      });

      // Redirect to frontend with success
      res.redirect('http://localhost:3000/integration?connected=true');
    } catch (error: any) {
      console.error('OAuth callback error:', error?.message);
      res.redirect('http://localhost:3000/integration?error=callback_failed');
    }
  })
);

/**
 * POST /api/integration/connect
 * Saves credentials manually (legacy/fallback).
 */
router.post(
  '/integration/connect',
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId, clientSecret, refreshToken, awsAccessKeyId, awsSecretAccessKey, roleArn, marketplaceId } = req.body;

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

    const integration = await prisma.integration.upsert({
      where: { storeId: store.id },
      create: {
        storeId: store.id,
        ...credentials,
        status: 'PENDING',
      },
      update: {
        ...credentials,
        status: 'PENDING',
        lastError: null,
      },
    });

    try {
      await testConnection(credentials);
      const updatedIntegration = await prisma.integration.update({
        where: { id: integration.id },
        data: { status: 'ACTIVE', lastError: null },
      });
      importHistoricalSales(credentials, store.id).catch((error) => {
        console.error('Background historical sales import failed:', error?.message);
      });
      res.json({ data: updatedIntegration });
    } catch (error: any) {
      const updatedIntegration = await prisma.integration.update({
        where: { id: integration.id },
        data: { status: 'ERROR', lastError: error?.message || 'Falha ao conectar com a Amazon' },
      });
      res.json({ data: updatedIntegration });
    }
  })
);

/**
 * GET /api/integration/status
 */
router.get(
  '/integration/status',
  asyncHandler(async (_req: Request, res: Response) => {
    const store = await prisma.store.findFirst();
    if (!store) {
      throw new NotFoundError('Loja não encontrada. Cadastre a loja primeiro.');
    }
    const integration = await prisma.integration.findUnique({ where: { storeId: store.id } });
    res.json({ data: integration || null });
  })
);

/**
 * POST /api/integration/sync/products
 */
router.post(
  '/integration/sync/products',
  asyncHandler(async (_req: Request, res: Response) => {
    const store = await prisma.store.findFirst();
    if (!store) throw new NotFoundError('Loja não encontrada.');

    const integration = await prisma.integration.findUnique({ where: { storeId: store.id } });
    if (!integration) throw new NotFoundError('Integração não configurada.');

    const credentials: AmazonCredentials = {
      clientId: integration.clientId,
      clientSecret: integration.clientSecret,
      refreshToken: integration.refreshToken,
      awsAccessKeyId: integration.awsAccessKeyId,
      awsSecretAccessKey: integration.awsSecretAccessKey,
      roleArn: integration.roleArn,
      marketplaceId: integration.marketplaceId,
    };

    importProducts(credentials, store.id).catch((error) => {
      console.error('Background product import failed:', error?.message);
    });

    res.status(202).json({ message: 'Importação de produtos iniciada' });
  })
);

/**
 * GET /api/integration/sync/progress
 */
router.get(
  '/integration/sync/progress',
  asyncHandler(async (req: Request, res: Response) => {
    const store = await prisma.store.findFirst();
    if (!store) throw new NotFoundError('Loja não encontrada.');

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
 */
router.post(
  '/integration/sync/sales',
  asyncHandler(async (_req: Request, res: Response) => {
    const store = await prisma.store.findFirst();
    if (!store) throw new NotFoundError('Loja não encontrada.');

    const integration = await prisma.integration.findUnique({ where: { storeId: store.id } });
    if (!integration) throw new NotFoundError('Integração não configurada.');
    if (integration.status !== 'ACTIVE') throw new ValidationError('Integração não está ativa.');

    const credentials: AmazonCredentials = {
      clientId: integration.clientId,
      clientSecret: integration.clientSecret,
      refreshToken: integration.refreshToken,
      awsAccessKeyId: integration.awsAccessKeyId,
      awsSecretAccessKey: integration.awsSecretAccessKey,
      roleArn: integration.roleArn,
      marketplaceId: integration.marketplaceId,
    };

    importHistoricalSales(credentials, store.id).catch((error) => {
      console.error('Background historical sales import failed:', error?.message);
    });

    res.status(202).json({ message: 'Importação de vendas históricas iniciada' });
  })
);

export default router;
