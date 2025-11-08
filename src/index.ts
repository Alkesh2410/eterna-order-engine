import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import dotenv from 'dotenv';
import { initPostgreSQL, initRedis } from './config/database';
import { createTables } from './db/migrations';
import { OrderRepository } from './db/orderRepository';
import { DEXRouter } from './services/dexRouter';
import { OrderProcessor } from './services/orderProcessor';
import { OrderQueue } from './queue/orderQueue';
import { orderRoutes } from './routes/orders';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000');

async function startServer() {
  try {
    // Initialize database connections
    console.log('Initializing database connections...');
    const pgPool = await initPostgreSQL();
    const redis = initRedis();

    // Run migrations
    await createTables(pgPool);

    // Initialize services
    const orderRepository = new OrderRepository(pgPool);
    const dexRouter = new DEXRouter();
    const orderProcessor = new OrderProcessor(dexRouter, orderRepository);
    const orderQueue = new OrderQueue(redis, orderProcessor);

    // Create Fastify instance
    const fastify = Fastify({
      logger: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      },
    });

    // Register WebSocket support
    await fastify.register(fastifyWebsocket);

    // Register routes
    await fastify.register(orderRoutes, {
      orderRepository,
      orderQueue,
      orderProcessor,
    });

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
      return reply.code(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    });

    // Start server
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`📝 API docs: http://0.0.0.0:${PORT}/api/orders/execute`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

startServer();

