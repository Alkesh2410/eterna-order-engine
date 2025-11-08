import { DEXRouter } from '../dexRouter';
import { OrderRequest, OrderType, DEXProvider } from '../../types/order';

describe('DEXRouter', () => {
  let router: DEXRouter;

  beforeEach(() => {
    router = new DEXRouter();
  });

  describe('fetchQuotes', () => {
    it('should fetch quotes from both Raydium and Meteora', async () => {
      const request: OrderRequest = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: '100',
      };

      const quotes = await router.fetchQuotes(request);

      expect(quotes).toHaveLength(2);
      expect(quotes.some((q) => q.provider === DEXProvider.RAYDIUM)).toBe(true);
      expect(quotes.some((q) => q.provider === DEXProvider.METEORA)).toBe(true);
    });

    it('should return quotes with valid structure', async () => {
      const request: OrderRequest = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: '50',
      };

      const quotes = await router.fetchQuotes(request);

      quotes.forEach((quote) => {
        expect(quote).toHaveProperty('provider');
        expect(quote).toHaveProperty('amountOut');
        expect(quote).toHaveProperty('price');
        expect(quote).toHaveProperty('liquidity');
        expect(parseFloat(quote.amountOut)).toBeGreaterThan(0);
        expect(parseFloat(quote.price)).toBeGreaterThan(0);
      });
    });
  });

  describe('selectBestDEX', () => {
    it('should select DEX with highest amountOut', () => {
      const quotes = [
        {
          provider: DEXProvider.RAYDIUM,
          amountOut: '100',
          price: '1.0',
          liquidity: '500000',
        },
        {
          provider: DEXProvider.METEORA,
          amountOut: '95',
          price: '0.95',
          liquidity: '300000',
        },
      ];

      const best = router.selectBestDEX(quotes);

      expect(best.provider).toBe(DEXProvider.RAYDIUM);
      expect(best.amountOut).toBe('100');
    });

    it('should handle single quote', () => {
      const quotes = [
        {
          provider: DEXProvider.RAYDIUM,
          amountOut: '100',
          price: '1.0',
          liquidity: '500000',
        },
      ];

      const best = router.selectBestDEX(quotes);
      expect(best.provider).toBe(DEXProvider.RAYDIUM);
    });

    it('should throw error when no quotes provided', () => {
      expect(() => router.selectBestDEX([])).toThrow('No quotes available');
    });
  });

  describe('buildTransaction', () => {
    it('should generate a transaction hash', async () => {
      const quote = {
        provider: DEXProvider.RAYDIUM,
        amountOut: '100',
        price: '1.0',
        liquidity: '500000',
      };

      const request: OrderRequest = {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: '100',
      };

      const txHash = await router.buildTransaction(quote, request);

      expect(txHash).toBeDefined();
      expect(typeof txHash).toBe('string');
      expect(txHash.length).toBe(64); // Mock hash length
    });
  });

  describe('submitTransaction', () => {
    it('should return boolean result', async () => {
      const txHash = 'abc123';
      const result = await router.submitTransaction(txHash);

      expect(typeof result).toBe('boolean');
    });
  });
});

