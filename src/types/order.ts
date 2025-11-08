export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  SNIPER = 'sniper',
}

export enum OrderStatus {
  PENDING = 'pending',
  ROUTING = 'routing',
  BUILDING = 'building',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum DEXProvider {
  RAYDIUM = 'raydium',
  METEORA = 'meteora',
}

export interface OrderRequest {
  type: OrderType;
  tokenIn: string; // Token address or 'SOL'
  tokenOut: string; // Token address or 'SOL'
  amountIn: string; // Amount as string to handle large numbers
  slippageTolerance?: number; // Percentage (default 1%)
  minAmountOut?: string; // Optional minimum output
}

export interface Order {
  id: string;
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut?: string;
  slippageTolerance: number;
  minAmountOut?: string;
  status: OrderStatus;
  dexProvider?: DEXProvider;
  executionPrice?: string;
  txHash?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  retryCount: number;
}

export interface DEXQuote {
  provider: DEXProvider;
  amountOut: string;
  price: string;
  liquidity: string;
  estimatedGas?: string;
}

export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  message?: string;
  dexProvider?: DEXProvider;
  executionPrice?: string;
  txHash?: string;
  error?: string;
}

