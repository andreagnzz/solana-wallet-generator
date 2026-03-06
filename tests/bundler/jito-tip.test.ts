import { calculateTip, tipToSol, formatTipInfo, TipResult } from '../../src/bundler/jito/jito-tip';
import { JitoClient } from '../../src/bundler/jito/jito-client';
import { PublicKey } from '@solana/web3.js';

jest.mock('../../src/bundler/jito/jito-client', () => {
  const actual = jest.requireActual('../../src/bundler/jito/jito-client');
  return {
    ...actual,
    JitoClient: jest.fn().mockImplementation(() => ({
      getTipFloor: jest.fn().mockResolvedValue({
        landed_tips_25th_percentile: 5000,
        landed_tips_50th_percentile: 25000,
        landed_tips_75th_percentile: 75000,
        landed_tips_95th_percentile: 500000,
      }),
    })),
    getRandomTipAccount: actual.getRandomTipAccount,
  };
});

describe('calculateTip', () => {
  let mockClient: JitoClient;

  beforeEach(() => {
    mockClient = new JitoClient();
  });

  it('returns custom tip amount', async () => {
    const result = await calculateTip(mockClient, 'custom', 99999);
    expect(result.lamports).toBe(99999);
    expect(result.strategy).toBe('custom');
    expect(result.tipAccount).toBeInstanceOf(PublicKey);
  });

  it('throws when custom strategy has no amount', async () => {
    await expect(calculateTip(mockClient, 'custom')).rejects.toThrow('positive customLamports');
  });

  it('throws when custom strategy has zero amount', async () => {
    await expect(calculateTip(mockClient, 'custom', 0)).rejects.toThrow('positive customLamports');
  });

  it('calculates min tip', async () => {
    const result = await calculateTip(mockClient, 'min');
    expect(result.lamports).toBeGreaterThanOrEqual(1000);
    expect(result.strategy).toBe('min');
  });

  it('calculates p25 tip', async () => {
    const result = await calculateTip(mockClient, 'p25');
    expect(result.lamports).toBe(5000);
  });

  it('calculates p50 tip', async () => {
    const result = await calculateTip(mockClient, 'p50');
    expect(result.lamports).toBe(25000);
  });

  it('calculates p75 tip', async () => {
    const result = await calculateTip(mockClient, 'p75');
    expect(result.lamports).toBe(75000);
  });

  it('calculates p95 tip', async () => {
    const result = await calculateTip(mockClient, 'p95');
    expect(result.lamports).toBe(500000);
  });
});

describe('tipToSol', () => {
  it('converts lamports to SOL', () => {
    expect(tipToSol(1_000_000_000)).toBe(1);
    expect(tipToSol(500_000_000)).toBe(0.5);
    expect(tipToSol(0)).toBe(0);
  });
});

describe('formatTipInfo', () => {
  it('formats tip info correctly', () => {
    const tip: TipResult = {
      lamports: 50000,
      tipAccount: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyRJFZnMP5bD2'),
      strategy: 'p50',
    };
    const formatted = formatTipInfo(tip);
    expect(formatted).toContain('50,000');
    expect(formatted).toContain('SOL');
    expect(formatted).toContain('p50');
    expect(formatted).toContain('96gYZGLn');
  });
});
