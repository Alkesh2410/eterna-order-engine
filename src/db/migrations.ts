import { Pool } from 'pg';

export const createTables = async (pool: Pool): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        token_in VARCHAR(255) NOT NULL,
        token_out VARCHAR(255) NOT NULL,
        amount_in VARCHAR(255) NOT NULL,
        amount_out VARCHAR(255),
        slippage_tolerance DECIMAL(5,2) DEFAULT 1.0,
        min_amount_out VARCHAR(255),
        status VARCHAR(50) NOT NULL,
        dex_provider VARCHAR(50),
        execution_price VARCHAR(255),
        tx_hash VARCHAR(255),
        error TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_tx_hash ON orders(tx_hash)
    `);

    await client.query('COMMIT');
    console.log('✅ Database tables created');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

