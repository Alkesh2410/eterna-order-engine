import { Pool } from 'pg';
import { Order, OrderStatus } from '../types/order';

export class OrderRepository {
  constructor(private pool: Pool) {}

  async create(order: Order): Promise<void> {
    const query = `
      INSERT INTO orders (
        id, type, token_in, token_out, amount_in, amount_out,
        slippage_tolerance, min_amount_out, status, dex_provider,
        execution_price, tx_hash, error, retry_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `;

    await this.pool.query(query, [
      order.id,
      order.type,
      order.tokenIn,
      order.tokenOut,
      order.amountIn,
      order.amountOut || null,
      order.slippageTolerance,
      order.minAmountOut || null,
      order.status,
      order.dexProvider || null,
      order.executionPrice || null,
      order.txHash || null,
      order.error || null,
      order.retryCount,
      order.createdAt,
      order.updatedAt,
    ]);
  }

  async update(order: Order): Promise<void> {
    const query = `
      UPDATE orders SET
        status = $2,
        amount_out = $3,
        dex_provider = $4,
        execution_price = $5,
        tx_hash = $6,
        error = $7,
        retry_count = $8,
        updated_at = $9
      WHERE id = $1
    `;

    await this.pool.query(query, [
      order.id,
      order.status,
      order.amountOut || null,
      order.dexProvider || null,
      order.executionPrice || null,
      order.txHash || null,
      order.error || null,
      order.retryCount,
      order.updatedAt,
    ]);
  }

  async findById(id: string): Promise<Order | null> {
    const query = 'SELECT * FROM orders WHERE id = $1';
    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToOrder(result.rows[0]);
  }

  async findByStatus(status: OrderStatus, limit: number = 100): Promise<Order[]> {
    const query = 'SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT $2';
    const result = await this.pool.query(query, [status, limit]);
    return result.rows.map((row) => this.mapRowToOrder(row));
  }

  private mapRowToOrder(row: any): Order {
    return {
      id: row.id,
      type: row.type,
      tokenIn: row.token_in,
      tokenOut: row.token_out,
      amountIn: row.amount_in,
      amountOut: row.amount_out,
      slippageTolerance: parseFloat(row.slippage_tolerance),
      minAmountOut: row.min_amount_out,
      status: row.status,
      dexProvider: row.dex_provider,
      executionPrice: row.execution_price,
      txHash: row.tx_hash,
      error: row.error,
      retryCount: row.retry_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

