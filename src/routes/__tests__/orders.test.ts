import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { orderRoutes } from '../orders';
import { OrderRepository } from '../../db/orderRepository';
import { OrderQueue } from '../../queue/orderQueue';
import { OrderProcessor } from '../../services/orderProcessor';
import { DEXRouter } from '../../services/dexRouter';
import { Order, OrderType, OrderStatus } from '../../types/order';

describe('Order Routes', () => {
  let app: any;
  let orderRepository: OrderRepository;
  let orderQueue: OrderQueue;
  let orderProcessor: OrderProcessor;

  beforeAll(async () => {
    // Create mock dependencies
    const mockDexRouter = {} as DEXRouter;
    orderRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByStatus: jest.fn(),
    } as any;

    orderProcessor = new OrderProcessor(mockDexRouter, orderRepository);
    orderQueue = {
      addOrder: jest.fn(),
      getStats: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        total: 0,
      }),
    } as any;

    app = Fastify();
    await app.register(fastifyWebsocket);
    await app.register(orderRoutes, {
      orderRepository,
      orderQueue,
      orderProcessor,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/orders/execute', () => {
    it('should create order successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          type: 'market',
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn: '100',
          slippageTolerance: 1.0,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('orderId');
      expect(body).toHaveProperty('message');
      expect(orderRepository.create).toHaveBeenCalled();
      expect(orderQueue.addOrder).toHaveBeenCalled();
    });

    it('should reject invalid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          type: 'invalid',
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn: '100',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          type: 'market',
          tokenIn: 'SOL',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/orders/:orderId', () => {
    it('should return order if exists', async () => {
      const mockOrder: Order = {
        id: 'test-order',
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: '100',
        slippageTolerance: 1.0,
        status: OrderStatus.PENDING,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (orderRepository.findById as jest.Mock).mockResolvedValue(mockOrder);

      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/test-order',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe('test-order');
    });

    it('should return 404 if order not found', async () => {
      (orderRepository.findById as jest.Mock).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/non-existent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/queue/stats', () => {
    it('should return queue statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/queue/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('waiting');
      expect(body).toHaveProperty('active');
      expect(body).toHaveProperty('completed');
      expect(body).toHaveProperty('failed');
    });
  });
});

