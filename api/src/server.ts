import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler';
import storeRoutes from './routes/store.routes';
import taxRoutes from './routes/tax.routes';
import integrationRoutes from './routes/integration.routes';
import productRoutes from './routes/product.routes';
import dashboardRoutes from './routes/dashboard.routes';
import saleRoutes from './routes/sale.routes';
import { startSyncJob } from './jobs/sync.job';

const app = express();

// Prisma Client instance
export const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
}));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api', storeRoutes);
app.use('/api', taxRoutes);
app.use('/api', integrationRoutes);
app.use('/api', productRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', saleRoutes);

// Global error handler (must be registered after routes)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });

  // Start the sales sync cron job
  startSyncJob();
}

export default app;
