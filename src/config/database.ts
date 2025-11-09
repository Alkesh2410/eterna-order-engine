import { Pool } from 'pg';
import Redis from 'ioredis';

let pgPool: Pool | null = null;
let redisClient: Redis | null = null;

export const initPostgreSQL = async (): Promise<Pool> => {
  if (pgPool) {
    return pgPool;
  }

  pgPool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'eterna_orders',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  try {
    await pgPool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected');
  } catch (error) {
    console.error('❌ PostgreSQL connection error:', error);
    throw error;
  }

  return pgPool;
};

export const initRedis = (): Redis => {
  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis({
    host: process.env.REDISHOST || 'localhost',
    port: parseInt(process.env.REDISPORT || '6379'),
    password: process.env.REDISPASSWORD || undefined,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis connected');
  });

  redisClient.on('error', (error: Error) => {
    console.error('❌ Redis connection error:', error);
  });

  return redisClient;
};

export const getPostgreSQL = (): Pool => {
  if (!pgPool) {
    throw new Error('PostgreSQL not initialized. Call initPostgreSQL() first.');
  }
  return pgPool;
};

export const getRedis = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call initRedis() first.');
  }
  return redisClient;
};

export const closeConnections = async (): Promise<void> => {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
};

