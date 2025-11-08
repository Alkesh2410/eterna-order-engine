# Eterna Order Execution Engine

A high-performance order execution engine with DEX routing and real-time WebSocket status updates. This system processes market orders, routes them to the best DEX (Raydium or Meteora), and provides live status updates through WebSocket connections.

## 🎯 Problem Statement

Build an order execution engine that processes orders with DEX routing and WebSocket status updates. The system supports market orders (with extensibility for limit and sniper orders), automatically routes to the best DEX based on price comparison, and streams execution progress in real-time.

## 🏗️ Architecture Overview

### Order Execution Flow

1. **Order Submission**: User submits order via `POST /api/orders/execute`
2. **Validation**: API validates order and returns `orderId`
3. **WebSocket Upgrade**: Same HTTP connection can upgrade to WebSocket for live updates
4. **DEX Routing**: System fetches quotes from Raydium and Meteora, compares prices, and selects best venue
5. **Execution**: Order progresses through states: `pending` → `routing` → `building` → `submitted` → `confirmed`/`failed`
6. **Settlement**: Transaction executed with slippage protection, returns execution price and txHash

### Why Market Orders?

Market orders were chosen as the primary order type because:
- **Immediate execution**: They provide instant liquidity access without waiting for price conditions
- **Simplicity**: Easier to implement and test, allowing focus on core routing and queue architecture
- **Common use case**: Most DEX trading volume consists of market orders

**Extensibility**: The engine can be extended to support limit and sniper orders by:
- **Limit orders**: Adding price monitoring logic that checks current market price against limit price before execution
- **Sniper orders**: Implementing token launch detection and immediate execution on new token listings

## 🚀 Features

- ✅ **Market Order Execution**: Immediate execution at best available price
- ✅ **DEX Routing**: Automatic routing to Raydium or Meteora based on best price/liquidity
- ✅ **WebSocket Status Updates**: Real-time order lifecycle streaming
- ✅ **Queue Management**: BullMQ with Redis, supports 10 concurrent orders, 100 orders/minute
- ✅ **Retry Logic**: Exponential backoff with ≤3 attempts
- ✅ **Slippage Protection**: Configurable slippage tolerance and minimum output amounts
- ✅ **Order History**: PostgreSQL persistence for all orders
- ✅ **Comprehensive Testing**: 10+ unit and integration tests

## 📋 Tech Stack

- **Runtime**: Node.js + TypeScript
- **Web Framework**: Fastify (with WebSocket support)
- **Queue**: BullMQ + Redis
- **Database**: PostgreSQL (order history) + Redis (active orders/cache)
- **Validation**: Zod
- **Testing**: Jest

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for local development)
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Eterna_Final
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start services with Docker Compose**
   ```bash
   docker-compose up -d
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Run migrations** (automatic on startup)

7. **Start the server**
   ```bash
   npm start
   # Or for development with hot reload:
   npm run dev
   ```

The server will start on `http://localhost:3000`

## 📡 API Endpoints

### POST /api/orders/execute

Submit an order for execution.

**Request Body:**
```json
{
  "type": "market",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": "100",
  "slippageTolerance": 1.0,
  "minAmountOut": "99"
}
```

**Response:**
```json
{
  "orderId": "uuid-here",
  "message": "Order submitted successfully. Upgrade connection to WebSocket for status updates."
}
```

### GET /api/orders/:orderId/status (WebSocket)

Connect to WebSocket for real-time order status updates.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/{orderId}/status');
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log(update);
};
```

**Status Update Format:**
```json
{
  "orderId": "uuid-here",
  "status": "routing",
  "message": "Comparing DEX prices",
  "dexProvider": "raydium",
  "executionPrice": "0.98",
  "txHash": "abc123...",
  "error": null
}
```

**Status Values:**
- `pending`: Order received and queued
- `routing`: Comparing DEX prices
- `building`: Creating transaction
- `submitted`: Transaction sent to network
- `confirmed`: Transaction successful (includes txHash)
- `failed`: Order failed (includes error)

### GET /api/orders/:orderId

Get order details.

**Response:**
```json
{
  "id": "uuid-here",
  "type": "market",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": "100",
  "amountOut": "98.5",
  "status": "confirmed",
  "dexProvider": "raydium",
  "executionPrice": "0.985",
  "txHash": "abc123...",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:05.000Z"
}
```

### GET /api/orders

List orders (optionally filtered by status).

**Query Parameters:**
- `status` (optional): Filter by status
- `limit` (optional): Limit results (default: 100)

### GET /api/queue/stats

Get queue statistics.

**Response:**
```json
{
  "waiting": 5,
  "active": 3,
  "completed": 100,
  "failed": 2,
  "total": 110
}
```

### GET /health

Health check endpoint.

## 🧪 Testing

Run all tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run tests in watch mode:
```bash
npm run test:watch
```

### Test Coverage

The test suite includes:
- ✅ DEX router quote fetching and selection logic
- ✅ Order processor status updates and retry logic
- ✅ Queue management and concurrency
- ✅ API endpoint validation and error handling
- ✅ Database repository operations
- ✅ Integration tests for complete order flow

## 📦 Postman/Insomnia Collection

Import `postman_collection.json` into Postman or Insomnia for easy API testing.

**Collection includes:**
- Health check
- Submit market order
- Submit order with slippage protection
- Get order details
- List orders
- Queue statistics
- Batch order submission examples

## 🔄 Order Processing

### Queue Configuration

- **Concurrency**: 10 orders processed simultaneously
- **Rate Limit**: 100 orders per minute
- **Retry Strategy**: Exponential backoff (2s, 4s, 8s) with max 3 attempts

### DEX Routing Logic

1. Fetch quotes from both Raydium and Meteora in parallel
2. Compare `amountOut` (best price wins)
3. Consider liquidity for stability
4. Select DEX with highest output amount
5. Log routing decision for transparency

### Error Handling

- Network failures trigger retry with exponential backoff
- Slippage protection validates minimum output
- Failed orders after max retries are marked as `failed` with error message
- All errors are persisted for post-mortem analysis

## 🚢 Deployment

### Environment Variables

Ensure these are set in your production environment:

```env
PORT=3000
NODE_ENV=production
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_DB=eterna_orders
POSTGRES_USER=your-user
POSTGRES_PASSWORD=your-password
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
QUEUE_CONCURRENCY=10
QUEUE_RATE_LIMIT=100
```

### Deployment Platforms

The application can be deployed to:
- **Render**: Free tier available for PostgreSQL and Redis
- **Railway**: Easy deployment with built-in PostgreSQL
- **Fly.io**: Global deployment with Redis support
- **Heroku**: With add-ons for PostgreSQL and Redis

### Build for Production

```bash
npm run build
npm start
```

## 📊 Monitoring

- Queue statistics available at `/api/queue/stats`
- Order history queryable via `/api/orders`
- Failed orders include error messages for debugging
- All routing decisions logged to console

## 🔐 Security Considerations

- Input validation using Zod schemas
- SQL injection protection via parameterized queries
- WebSocket connection validation
- Rate limiting via BullMQ
- Environment variable management

## 📝 Design Decisions

### Why Fastify?

- Built-in WebSocket support
- High performance (faster than Express)
- Schema validation support
- TypeScript-friendly

### Why BullMQ?

- Redis-backed queue with persistence
- Built-in rate limiting and concurrency control
- Retry mechanisms with backoff strategies
- Job prioritization support

### Why Mock Implementation?

- Focus on architecture and flow rather than blockchain complexity
- Faster development and testing cycles
- Easier to demonstrate routing logic
- Can be extended to real DEX integration later

### Database Choice

- **PostgreSQL**: Reliable ACID transactions for order history
- **Redis**: Fast in-memory storage for active orders and queue state

## 🎥 Demo Video

[Link to YouTube video demonstrating functionality]

The video shows:
- Submitting 3-5 orders simultaneously
- WebSocket status updates (pending → routing → confirmed)
- DEX routing decisions in console logs
- Queue processing multiple orders concurrently

## 🔮 Future Enhancements

- Real DEX integration with Raydium and Meteora SDKs
- Limit order support with price monitoring
- Sniper order support for token launches
- Advanced slippage protection strategies
- Order cancellation
- Historical analytics
- WebSocket authentication and authorization

## 📄 License

MIT

## 👤 Author

Built for Eterna order execution engine challenge.

---

**Note**: This is a mock implementation focusing on architecture and flow. For production use with real DEXs, integrate actual SDKs and handle network failures, gas estimation, and transaction confirmation more robustly.

## 📦 Project Structure

```
Eterna_Final/
├── src/
│   ├── config/          # Database configuration
│   ├── db/              # Database migrations and repositories
│   ├── services/        # Business logic (DEX router, order processor)
│   ├── queue/           # BullMQ queue management
│   ├── routes/          # API routes
│   ├── types/           # TypeScript type definitions
│   └── index.ts         # Application entry point
├── examples/            # Example scripts and clients
├── tests/               # Test files
├── docker-compose.yml   # Local development setup
├── Dockerfile          # Production Docker image
└── README.md           # This file
```

## 🚀 Quick Start

```bash
# Clone repository
git clone <repository-url>
cd Eterna_Final

# Install dependencies
npm install

# Start PostgreSQL and Redis
docker-compose up -d

# Build and start
npm run build
npm start
```

## 📝 API Documentation

Full API documentation is available in the Postman collection (`postman_collection.json`).

### Example: Submit Order and Connect to WebSocket

```javascript
// 1. Submit order
const response = await fetch('http://localhost:3000/api/orders/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'market',
    tokenIn: 'SOL',
    tokenOut: 'USDC',
    amountIn: '100',
    slippageTolerance: 1.0
  })
});

const { orderId } = await response.json();

// 2. Connect to WebSocket
const ws = new WebSocket(`ws://localhost:3000/api/orders/${orderId}/status`);
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Status:', update.status);
};
```

## 🔍 Key Features Explained

### DEX Routing
The system automatically compares prices from Raydium and Meteora, selecting the DEX with the best execution price. Routing decisions are logged for transparency.

### Queue Management
Orders are processed through BullMQ with:
- 10 concurrent orders
- 100 orders per minute rate limit
- Automatic retry with exponential backoff

### WebSocket Updates
Real-time status updates stream through WebSocket connections, allowing clients to track order progress without polling.

## 📊 Performance

- **Throughput**: 100 orders/minute
- **Concurrency**: 10 simultaneous orders
- **Latency**: ~2-5 seconds per order (mock implementation)
- **Database**: PostgreSQL for persistence
- **Cache**: Redis for active orders and queue state

## 🛡️ Error Handling

- Input validation with Zod schemas
- Retry logic with exponential backoff (max 3 attempts)
- Slippage protection
- Comprehensive error logging
- Failed orders persisted with error messages

## 📚 Additional Resources

- [Fastify Documentation](https://www.fastify.io/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/docs/)

