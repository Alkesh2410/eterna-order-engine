import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { OrderType, OrderStatus } from '../types/order';
import { OrderRepository } from '../db/orderRepository';
import { OrderQueue } from '../queue/orderQueue';
import { OrderProcessor } from '../services/orderProcessor';

const orderRequestSchema = z.object({
  type: z.enum(['market', 'limit', 'sniper']),
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amountIn: z.string().regex(/^\d+(\.\d+)?$/),
  slippageTolerance: z.number().min(0).max(50).optional(),
  minAmountOut: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

export async function orderRoutes(
  fastify: FastifyInstance,
  options: {
    orderRepository: OrderRepository;
    orderQueue: OrderQueue;
    orderProcessor: OrderProcessor;
  }
) {
  const { orderRepository, orderQueue, orderProcessor } = options;

  /**
   * POST /api/orders/execute
   * Submit an order for execution
   */
  fastify.post(
    '/api/orders/execute',
    {
      schema: {
        description: 'Submit an order for execution',
        tags: ['orders'],
        body: {
          type: 'object',
          required: ['type', 'tokenIn', 'tokenOut', 'amountIn'],
          properties: {
            type: { type: 'string', enum: ['market', 'limit', 'sniper'] },
            tokenIn: { type: 'string' },
            tokenOut: { type: 'string' },
            amountIn: { type: 'string' },
            slippageTolerance: { type: 'number', minimum: 0, maximum: 50 },
            minAmountOut: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              orderId: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate request body
        const body = orderRequestSchema.parse(request.body);

        // Create order
        const orderId = uuidv4();
        const order = {
          id: orderId,
          type: body.type as OrderType,
          tokenIn: body.tokenIn,
          tokenOut: body.tokenOut,
          amountIn: body.amountIn,
          slippageTolerance: body.slippageTolerance || 1.0,
          minAmountOut: body.minAmountOut,
          status: OrderStatus.PENDING,
          retryCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Save to database
        await orderRepository.create(order);

        // Add to queue
        await orderQueue.addOrder(order);

        return reply.code(200).send({
          orderId,
          message: 'Order submitted successfully. Upgrade connection to WebSocket for status updates.',
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'Validation error',
            details: error.errors,
          });
        }

        console.error('Error creating order:', error);
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * WebSocket endpoint for order status updates
   * GET /api/orders/:orderId/status
   */
  fastify.get(
    '/api/orders/:orderId/status',
    { websocket: true },
    async (connection: any, request: FastifyRequest) => {
      const orderId = (request.params as { orderId: string }).orderId;

      // Verify order exists
      const order = await orderRepository.findById(orderId);
      if (!order) {
        connection.socket.send(
          JSON.stringify({
            error: 'Order not found',
            orderId,
          })
        );
        connection.socket.close();
        return;
      }

      // Send initial status
      connection.socket.send(
        JSON.stringify({
          orderId,
          status: order.status,
          message: 'Connected to order status stream',
          dexProvider: order.dexProvider,
          executionPrice: order.executionPrice,
          txHash: order.txHash,
          error: order.error,
        })
      );

      // Subscribe to status updates
      const unsubscribe = orderProcessor.subscribe(orderId, (update) => {
        try {
          connection.socket.send(JSON.stringify(update));
        } catch (error) {
          console.error(`Error sending update for order ${orderId}:`, error);
        }
      });

      // Handle connection close
      connection.socket.on('close', () => {
        unsubscribe();
        console.log(`WebSocket closed for order ${orderId}`);
      });

      // Handle errors
      connection.socket.on('error', (error: Error) => {
        console.error(`WebSocket error for order ${orderId}:`, error);
        unsubscribe();
      });
    }
  );

  /**
   * GET /api/orders/:orderId
   * Get order details
   */
  fastify.get(
    '/api/orders/:orderId',
    {
      schema: {
        description: 'Get order details',
        tags: ['orders'],
        params: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orderId = (request.params as { orderId: string }).orderId;
      const order = await orderRepository.findById(orderId);

      if (!order) {
        return reply.code(404).send({
          error: 'Order not found',
        });
      }

      return reply.code(200).send(order);
    }
  );

  /**
   * GET /api/orders
   * List orders with optional status filter
   */
  fastify.get(
    '/api/orders',
    {
      schema: {
        description: 'List orders',
        tags: ['orders'],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            limit: { type: 'number', default: 100 },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { status, limit } = request.query as {
        status?: string;
        limit?: number;
      };

      if (status) {
        const orders = await orderRepository.findByStatus(status as OrderStatus, limit);
        return reply.code(200).send({ orders });
      }

      // If no status filter, return all orders (simplified - in production, add pagination)
      const allStatuses = Object.values(OrderStatus);
      const allOrders = [];
      for (const orderStatus of allStatuses) {
        const orders = await orderRepository.findByStatus(orderStatus, limit || 100);
        allOrders.push(...orders);
      }

      return reply.code(200).send({ orders: allOrders });
    }
  );

  /**
   * GET /api/queue/stats
   * Get queue statistics
   */
  fastify.get(
    '/api/queue/stats',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const stats = await orderQueue.getStats();
      return reply.code(200).send(stats);
    }
  );
}

