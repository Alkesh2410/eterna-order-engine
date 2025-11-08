import { Order, OrderStatus, OrderStatusUpdate, DEXQuote } from '../types/order';
import { DEXRouter } from './dexRouter';
import { OrderRepository } from '../db/orderRepository';
import { getRedis } from '../config/database';

export class OrderProcessor {
  private redis = getRedis();
  private subscribers: Map<string, Set<(update: OrderStatusUpdate) => void>> = new Map();

  constructor(
    private dexRouter: DEXRouter,
    private orderRepository: OrderRepository
  ) {}

  /**
   * Subscribe to order status updates
   */
  subscribe(orderId: string, callback: (update: OrderStatusUpdate) => void): () => void {
    if (!this.subscribers.has(orderId)) {
      this.subscribers.set(orderId, new Set());
    }
    this.subscribers.get(orderId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(orderId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(orderId);
        }
      }
    };
  }

  /**
   * Emit status update to all subscribers
   */
  private emitUpdate(update: OrderStatusUpdate): void {
    const callbacks = this.subscribers.get(update.orderId);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(update);
        } catch (error) {
          console.error(`Error in status update callback for order ${update.orderId}:`, error);
        }
      });
    }

    // Also store in Redis for persistence
    this.redis.setex(
      `order:${update.orderId}:status`,
      3600, // 1 hour TTL
      JSON.stringify(update)
    );
  }

  /**
   * Process order through the execution pipeline
   */
  async processOrder(order: Order, maxRetries: number = 3): Promise<void> {
    try {
      // Update status: PENDING
      await this.updateOrderStatus(order, OrderStatus.PENDING, 'Order received and queued');

      // Update status: ROUTING
      await this.updateOrderStatus(order, OrderStatus.ROUTING, 'Comparing DEX prices');

      // Fetch quotes from all DEXs
      let quotes: DEXQuote[];
      try {
        quotes = await this.dexRouter.fetchQuotes({
          type: order.type,
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          amountIn: order.amountIn,
          slippageTolerance: order.slippageTolerance,
          minAmountOut: order.minAmountOut,
        });
      } catch (error) {
        throw new Error(`Failed to fetch DEX quotes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Select best DEX
      const bestQuote = this.dexRouter.selectBestDEX(quotes);
      order.dexProvider = bestQuote.provider;
      order.amountOut = bestQuote.amountOut;
      order.executionPrice = bestQuote.price;

      // Check slippage protection
      if (order.minAmountOut) {
        const minAmount = parseFloat(order.minAmountOut);
        const actualAmount = parseFloat(bestQuote.amountOut);
        if (actualAmount < minAmount) {
          throw new Error(
            `Slippage protection triggered: expected at least ${minAmount}, got ${actualAmount}`
          );
        }
      }

      // Update status: BUILDING
      await this.updateOrderStatus(order, OrderStatus.BUILDING, 'Creating transaction');

      // Build transaction
      let txHash: string;
      try {
        txHash = await this.dexRouter.buildTransaction(bestQuote, {
          type: order.type,
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          amountIn: order.amountIn,
          slippageTolerance: order.slippageTolerance,
          minAmountOut: order.minAmountOut,
        });
      } catch (error) {
        throw new Error(`Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      order.txHash = txHash;

      // Update status: SUBMITTED
      await this.updateOrderStatus(order, OrderStatus.SUBMITTED, 'Transaction sent to network');

      // Submit and confirm transaction
      const success = await this.dexRouter.submitTransaction(txHash);

      if (!success) {
        throw new Error('Transaction submission failed');
      }

      // Update status: CONFIRMED
      await this.updateOrderStatus(
        order,
        OrderStatus.CONFIRMED,
        'Transaction successful',
        txHash
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Order ${order.id} failed:`, errorMessage);

      // Retry logic with exponential backoff
      if (order.retryCount < maxRetries) {
        order.retryCount++;
        const backoffDelay = Math.pow(2, order.retryCount) * 1000; // Exponential backoff
        
        console.log(
          `Retrying order ${order.id} (attempt ${order.retryCount}/${maxRetries}) after ${backoffDelay}ms`
        );

        await this.delay(backoffDelay);
        return this.processOrder(order, maxRetries);
      } else {
        // Max retries reached, mark as failed
        order.error = errorMessage;
        await this.updateOrderStatus(
          order,
          OrderStatus.FAILED,
          `Order failed after ${maxRetries} attempts: ${errorMessage}`
        );
      }
    }
  }

  /**
   * Update order status and emit update
   */
  private async updateOrderStatus(
    order: Order,
    status: OrderStatus,
    message?: string,
    txHash?: string
  ): Promise<void> {
    order.status = status;
    order.updatedAt = new Date();
    
    if (txHash) {
      order.txHash = txHash;
    }

    // Persist to database
    await this.orderRepository.update(order);

    // Emit WebSocket update
    const update: OrderStatusUpdate = {
      orderId: order.id,
      status,
      message,
      dexProvider: order.dexProvider,
      executionPrice: order.executionPrice,
      txHash: order.txHash,
      error: order.error,
    };

    this.emitUpdate(update);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

