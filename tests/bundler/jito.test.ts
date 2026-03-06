import { PublicKey } from '@solana/web3.js';
import {
  JitoClient,
  JITO_ENDPOINTS,
  JITO_TIP_ACCOUNTS,
  getRandomTipAccount,
} from '../../src/bundler/jito/jito-client';
import { tipToSol } from '../../src/bundler/jito/jito-tip';
import { classifySolanaError } from '../../src/bundler/shared/retry';

describe('Jito Client', () => {
  test('has correct endpoint URLs', () => {
    expect(JITO_ENDPOINTS.mainnet).toBe('https://mainnet.block-engine.jito.wtf');
    expect(JITO_ENDPOINTS.amsterdam).toBe('https://amsterdam.mainnet.block-engine.jito.wtf');
    expect(JITO_ENDPOINTS.frankfurt).toBe('https://frankfurt.mainnet.block-engine.jito.wtf');
    expect(JITO_ENDPOINTS.ny).toBe('https://ny.mainnet.block-engine.jito.wtf');
    expect(JITO_ENDPOINTS.tokyo).toBe('https://tokyo.mainnet.block-engine.jito.wtf');
  });

  test('initializes with default region', () => {
    const client = new JitoClient();
    expect(client.getRegion()).toBe('mainnet');
    expect(client.getEndpoint()).toBe(JITO_ENDPOINTS.mainnet);
  });

  test('initializes with custom region', () => {
    const client = new JitoClient({ region: 'amsterdam' });
    expect(client.getRegion()).toBe('amsterdam');
    expect(client.getEndpoint()).toBe(JITO_ENDPOINTS.amsterdam);
  });

  test('has 8 official tip accounts', () => {
    expect(JITO_TIP_ACCOUNTS.length).toBe(8);
    for (const account of JITO_TIP_ACCOUNTS) {
      expect(account).toBeInstanceOf(PublicKey);
    }
  });

  test('getRandomTipAccount returns a valid tip account', () => {
    const account = getRandomTipAccount();
    expect(account).toBeInstanceOf(PublicKey);
    expect(JITO_TIP_ACCOUNTS.some(a => a.equals(account))).toBe(true);
  });

  test('random tip account selection has variety', () => {
    const accounts = new Set<string>();
    // With 8 accounts and 100 tries, we should get at least 2 different ones
    for (let i = 0; i < 100; i++) {
      accounts.add(getRandomTipAccount().toBase58());
    }
    expect(accounts.size).toBeGreaterThanOrEqual(2);
  });
});

describe('Tip Calculations', () => {
  test('tipToSol converts correctly', () => {
    expect(tipToSol(1_000_000_000)).toBe(1);
    expect(tipToSol(500_000_000)).toBe(0.5);
    expect(tipToSol(1000)).toBe(0.000001);
    expect(tipToSol(0)).toBe(0);
  });
});

describe('Error Classification', () => {
  test('classifies blockhash expired', () => {
    expect(classifySolanaError(new Error('Blockhash not found'))).toBe('blockhash-expired');
    expect(classifySolanaError(new Error('blockhash has expired'))).toBe('blockhash-expired');
  });

  test('classifies rate limiting', () => {
    expect(classifySolanaError(new Error('429 Too Many Requests'))).toBe('rate-limited');
    expect(classifySolanaError(new Error('rate limit exceeded'))).toBe('rate-limited');
  });

  test('classifies insufficient funds', () => {
    expect(classifySolanaError(new Error('insufficient funds for transfer'))).toBe('insufficient-funds');
    expect(classifySolanaError(new Error('Insufficient lamports'))).toBe('insufficient-funds');
  });

  test('classifies simulation failure', () => {
    expect(classifySolanaError(new Error('Simulation failed'))).toBe('simulation-failed');
    expect(classifySolanaError(new Error('custom program error: 0x1'))).toBe('simulation-failed');
  });

  test('classifies timeout', () => {
    expect(classifySolanaError(new Error('Request timed out'))).toBe('timeout');
    expect(classifySolanaError(new Error('ECONNREFUSED'))).toBe('timeout');
  });

  test('classifies unknown errors', () => {
    expect(classifySolanaError(new Error('something weird happened'))).toBe('unknown');
  });
});
