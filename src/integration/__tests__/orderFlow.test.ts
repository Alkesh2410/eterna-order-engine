import { OrderProcessor } from '../../services/orderProcessor';
import { DEXRouter } from '../../services/dexRouter';
import { OrderRepository } from '../../db/orderRepository';
import { Order, OrderType, OrderStatus, DEXProvider } from '../../types/order';

// Mock Redis
jest.mock('../../config/database', () => ({
  getRedis: jest.fn(() => ({
    setex: jest.fn(),
  })),
}));

/**
 * Integration test for complete order flow
 */
describe('Order Flow Integration', () => {
  let processor: OrderProcessor;
  let dexRouter: DEXRouter;
  let mockOrderRepository: jest.Mocked<OrderRepository>;

  beforeEach(() => {
    dexRouter = new DEXRouter();
    mockOrderRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByStatus: jest.fn(),
    } as any;

    processor = new OrderProcessor(dexRouter, mockOrderRepository);
  });

  it('should complete full order lifecycle', async () => {
    const order: Order = {
      id: 'integration-test-order',
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

    const statusUpdates: OrderStatus[] = [];
    const callback = jest.fn((update) => {
      statusUpdates.push(update.status);
    });

    processor.subscribe(order.id, callback);

    // Mock repository to track status changes
    (mockOrderRepository.update as jest.Mock).mockImplementation(async (updatedOrder) => {
      // Verify status progression
      if (statusUpdates.length > 0) {
        expect(updatedOrder.status).toBeDefined();
      }
    });

    await processor.processOrder(order, 1);

    // Verify status progression
    expect(statusUpdates).toContain(OrderStatus.PENDING);
    expect(statusUpdates).toContain(OrderStatus.ROUTING);
    expect(statusUpdates).toContain(OrderStatus.BUILDING);
    expect(statusUpdates).toContain(OrderStatus.SUBMITTED);
    
    // Final status should be either confirmed or failed
    expect([OrderStatus.CONFIRMED, OrderStatus.FAILED]).toContain(order.status);
    
    // Verify callback was called multiple times
    expect(callback.mock.calls.length).toBeGreaterThan(3);
  });

  it('should handle DEX routing correctly', async () => {
    const order: Order = {
      id: 'routing-test-order',
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

    await processor.processOrder(order, 1);

    // Verify DEX provider was selected
    expect([DEXProvider.RAYDIUM, DEXProvider.METEORA]).toContain(order.dexProvider);
    expect(order.executionPrice).toBeDefined();
    expect(order.amountOut).toBeDefined();
  });
});

