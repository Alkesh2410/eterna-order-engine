import { OrderProcessor } from '../orderProcessor';
import { DEXRouter } from '../dexRouter';
import { OrderRepository } from '../../db/orderRepository';
import { Order, OrderStatus, OrderType, DEXProvider } from '../../types/order';

// Mock Redis
jest.mock('../../config/database', () => ({
  getRedis: jest.fn(() => ({
    setex: jest.fn(),
  })),
}));

describe('OrderProcessor', () => {
  let processor: OrderProcessor;
  let mockDexRouter: jest.Mocked<DEXRouter>;
  let mockOrderRepository: jest.Mocked<OrderRepository>;

  beforeEach(() => {
    mockDexRouter = {
      fetchQuotes: jest.fn(),
      selectBestDEX: jest.fn(),
      buildTransaction: jest.fn(),
      submitTransaction: jest.fn(),
    } as any;

    mockOrderRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByStatus: jest.fn(),
    } as any;

    processor = new OrderProcessor(mockDexRouter, mockOrderRepository);
  });

  describe('subscribe', () => {
    it('should subscribe to order updates', () => {
      const callback = jest.fn();
      const unsubscribe = processor.subscribe('order-123', callback);

      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow unsubscribing', () => {
      const callback = jest.fn();
      const unsubscribe = processor.subscribe('order-123', callback);
      
      unsubscribe();
      // Should not throw
      expect(unsubscribe).toBeDefined();
    });
  });

  describe('processOrder', () => {
    const createMockOrder = (): Order => ({
      id: 'order-123',
      type: OrderType.MARKET,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: '100',
      slippageTolerance: 1.0,
      status: OrderStatus.PENDING,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should process order successfully', async () => {
      const order = createMockOrder();

      mockDexRouter.fetchQuotes.mockResolvedValue([
        {
          provider: DEXProvider.RAYDIUM,
          amountOut: '98',
          price: '0.98',
          liquidity: '500000',
        },
        {
          provider: DEXProvider.METEORA,
          amountOut: '96',
          price: '0.96',
          liquidity: '300000',
        },
      ]);

      mockDexRouter.selectBestDEX.mockReturnValue({
        provider: DEXProvider.RAYDIUM,
        amountOut: '98',
        price: '0.98',
        liquidity: '500000',
      });

      mockDexRouter.buildTransaction.mockResolvedValue('tx-hash-123');
      mockDexRouter.submitTransaction.mockResolvedValue(true);

      const callback = jest.fn();
      processor.subscribe(order.id, callback);

      await processor.processOrder(order);

      expect(mockDexRouter.fetchQuotes).toHaveBeenCalled();
      expect(mockDexRouter.selectBestDEX).toHaveBeenCalled();
      expect(mockDexRouter.buildTransaction).toHaveBeenCalled();
      expect(mockDexRouter.submitTransaction).toHaveBeenCalled();
      expect(mockOrderRepository.update).toHaveBeenCalled();
      expect(order.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should handle slippage protection', async () => {
      const order = createMockOrder();
      order.minAmountOut = '99';

      mockDexRouter.fetchQuotes.mockResolvedValue([
        {
          provider: DEXProvider.RAYDIUM,
          amountOut: '98',
          price: '0.98',
          liquidity: '500000',
        },
      ]);

      mockDexRouter.selectBestDEX.mockReturnValue({
        provider: DEXProvider.RAYDIUM,
        amountOut: '98',
        price: '0.98',
        liquidity: '500000',
      });

      await processor.processOrder(order, 1);

      expect(order.status).toBe(OrderStatus.FAILED);
      expect(order.error).toContain('Slippage protection');
    });

    it('should retry on failure with exponential backoff', async () => {
      const order = createMockOrder();

      mockDexRouter.fetchQuotes.mockRejectedValue(new Error('Network error'));

      const startTime = Date.now();
      await processor.processOrder(order, 3);
      const endTime = Date.now();

      expect(order.retryCount).toBe(3);
      expect(order.status).toBe(OrderStatus.FAILED);
      // Should have retried with delays
      expect(endTime - startTime).toBeGreaterThan(1000);
    });
  });
});

