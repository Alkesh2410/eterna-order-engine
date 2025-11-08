# Deployment Guide

This guide covers deploying the Eterna Order Execution Engine to various hosting platforms.

## Prerequisites

- Node.js 18+
- PostgreSQL database (managed or self-hosted)
- Redis instance (managed or self-hosted)
- Git repository

## Environment Variables

Create a `.env` file or set these in your hosting platform:

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

## Deployment Options

### Option 1: Render

1. **Create a new Web Service**
   - Connect your GitHub repository
   - Select Node.js environment
   - Build command: `npm install && npm run build`
   - Start command: `npm start`

2. **Add PostgreSQL Database**
   - Create a new PostgreSQL database
   - Copy connection string to `POSTGRES_*` environment variables

3. **Add Redis Instance**
   - Create a new Redis instance
   - Copy connection details to `REDIS_*` environment variables

4. **Deploy**
   - Render will automatically deploy on push to main branch

### Option 2: Railway

1. **Create New Project**
   - Connect GitHub repository
   - Add PostgreSQL service
   - Add Redis service
   - Add Node.js service

2. **Configure Services**
   - Set environment variables in Railway dashboard
   - Build command: `npm install && npm run build`
   - Start command: `npm start`

3. **Deploy**
   - Railway auto-deploys on git push

### Option 3: Fly.io

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create Fly App**
   ```bash
   fly launch
   ```

3. **Add PostgreSQL**
   ```bash
   fly postgres create
   fly postgres attach <postgres-app-name> -a <your-app-name>
   ```

4. **Add Redis**
   ```bash
   fly redis create
   fly redis attach <redis-app-name> -a <your-app-name>
   ```

5. **Deploy**
   ```bash
   fly deploy
   ```

### Option 4: Heroku

1. **Install Heroku CLI**
   ```bash
   heroku login
   ```

2. **Create App**
   ```bash
   heroku create your-app-name
   ```

3. **Add PostgreSQL**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

4. **Add Redis**
   ```bash
   heroku addons:create heroku-redis:mini
   ```

5. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   ```

6. **Deploy**
   ```bash
   git push heroku main
   ```

## Docker Deployment

If you prefer Docker:

1. **Build Image**
   ```bash
   docker build -t eterna-engine .
   ```

2. **Run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

## Post-Deployment

1. **Verify Health**
   ```bash
   curl https://your-app-url/health
   ```

2. **Test Order Submission**
   ```bash
   curl -X POST https://your-app-url/api/orders/execute \
     -H "Content-Type: application/json" \
     -d '{
       "type": "market",
       "tokenIn": "SOL",
       "tokenOut": "USDC",
       "amountIn": "100"
     }'
   ```

3. **Check Queue Stats**
   ```bash
   curl https://your-app-url/api/queue/stats
   ```

## Monitoring

- Health endpoint: `/health`
- Queue statistics: `/api/queue/stats`
- Order history: `/api/orders`

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is accessible
- Check firewall rules
- Verify credentials

### Redis Connection Issues
- Verify Redis is accessible
- Check if Redis requires password
- Verify port is correct

### Build Failures
- Ensure Node.js 18+ is used
- Check all dependencies are in package.json
- Verify TypeScript compilation

## Scaling

For high traffic:
- Increase `QUEUE_CONCURRENCY` (default: 10)
- Increase `QUEUE_RATE_LIMIT` (default: 100/minute)
- Use connection pooling for PostgreSQL
- Consider Redis cluster for high availability

