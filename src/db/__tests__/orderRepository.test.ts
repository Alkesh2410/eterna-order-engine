import { OrderRepository } from '../orderRepository';
import { Pool } from 'pg';
import { Order, OrderType, OrderStatus } from '../../types/order';

describe('OrderRepository', () => {
  let repository: OrderRepository;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
    } as any;

    repository = new OrderRepository(mockPool);
  });

  describe('create', () => {
    it('should insert order into database', async () => {
      const order: Order = {
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

      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await repository.create(order);

      expect(mockPool.query).toHaveBeenCalled();
      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('INSERT INTO orders');
    });
  });

  describe('update', () => {
    it('should update order in database', async () => {
      const order: Order = {
        id: 'test-order',
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: '100',
        slippageTolerance: 1.0,
        status: OrderStatus.CONFIRMED,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        txHash: 'test-hash',
      };

      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await repository.update(order);

      expect(mockPool.query).toHaveBeenCalled();
      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('UPDATE orders');
    });
  });

  describe('findById', () => {
    it('should return order if exists', async () => {
      const mockRow = {
        id: 'test-order',
        type: OrderType.MARKET,
        token_in: 'SOL',
        token_out: 'USDC',
        amount_in: '100',
        amount_out: null,
        slippage_tolerance: '1.0',
        min_amount_out: null,
        status: OrderStatus.PENDING,
        dex_provider: null,
        execution_price: null,
        tx_hash: null,
        error: null,
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      const order = await repository.findById('test-order');

      expect(order).toBeDefined();
      expect(order?.id).toBe('test-order');
    });

    it('should return null if order not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const order = await repository.findById('non-existent');

      expect(order).toBeNull();
    });
  });
});

