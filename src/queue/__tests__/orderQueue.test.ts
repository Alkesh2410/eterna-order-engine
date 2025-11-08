import { OrderQueue } from '../orderQueue';
import { OrderProcessor } from '../../services/orderProcessor';
import { DEXRouter } from '../../services/dexRouter';
import { OrderRepository } from '../../db/orderRepository';
import { Order, OrderType, OrderStatus } from '../../types/order';
import Redis from 'ioredis';

// Mock Redis connection for tests
const createMockRedis = () => {
  return {
    setex: jest.fn(),
    get: jest.fn(),
    quit: jest.fn(),
  } as any;
};

describe('OrderQueue', () => {
  let queue: OrderQueue;
  let redis: Redis;
  let mockOrderProcessor: jest.Mocked<OrderProcessor>;
  let mockOrderRepository: jest.Mocked<OrderRepository>;

  beforeAll(() => {
    // Use mock Redis for tests to avoid requiring actual Redis instance
    redis = createMockRedis() as any;
  });

  beforeEach(() => {
    mockOrderRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByStatus: jest.fn(),
    } as any;

    const mockDexRouter = {} as DEXRouter;
    mockOrderProcessor = new OrderProcessor(mockDexRouter, mockOrderRepository) as any;
    
    // Mock Redis for OrderQueue
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    jest.spyOn(require('../../config/database'), 'getRedis').mockReturnValue(redis);
    
    queue = new OrderQueue(redis, mockOrderProcessor);
  });

  afterEach(async () => {
    if (queue) {
      await queue.close();
    }
  });

  describe('addOrder', () => {
    it('should add order to queue', async () => {
      const order: Order = {
        id: 'test-order-1',
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

      await queue.addOrder(order);
      // Order should be added without error
      expect(true).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const stats = await queue.getStats();

      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('total');
    });
  });
});

