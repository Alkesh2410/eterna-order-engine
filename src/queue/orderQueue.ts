import { Queue, Worker, QueueOptions } from 'bullmq';
import Redis from 'ioredis';
import { Order } from '../types/order';
import { OrderProcessor } from '../services/orderProcessor';

export class OrderQueue {
  private queue: Queue<Order, void>;
  private worker: Worker<Order, void>;
  private orderProcessor: OrderProcessor;

  constructor(redis: Redis, orderProcessor: OrderProcessor) {
    const queueOptions: QueueOptions = {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    };

    this.queue = new Queue<Order, void>('order-execution', queueOptions);
    this.orderProcessor = orderProcessor;

    // Configure worker with concurrency and rate limiting
    const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '10');
    const rateLimit = {
      max: parseInt(process.env.QUEUE_RATE_LIMIT || '100'),
      duration: 60000, // per minute
    };

    this.worker = new Worker<Order, void>(
      'order-execution',
      async (job) => {
        const order = job.data;
        console.log(`Processing order ${order.id} (job ${job.id})`);
        await this.orderProcessor.processOrder(order);
      },
      {
        connection: queueOptions.connection,
        concurrency,
        limiter: rateLimit,
      }
    );

    this.setupWorkerHandlers();
  }

  /**
   * Add order to queue
   */
  async addOrder(order: Order): Promise<void> {
    await this.queue.add(`order-${order.id}`, order, {
      jobId: order.id,
    });
    console.log(`Order ${order.id} added to queue`);
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
    };
  }

  private setupWorkerHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('❌ Worker error:', err);
    });
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }
}

