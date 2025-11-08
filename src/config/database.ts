import { Pool } from 'pg';
import Redis from 'ioredis';

let pgPool: Pool | null = null;
let redisClient: Redis | null = null;

export const initPostgreSQL = async (): Promise<Pool> => {
  if (pgPool) {
    return pgPool;
  }

  pgPool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'eterna_orders',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
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
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
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

