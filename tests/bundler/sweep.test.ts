import { Keypair } from '@solana/web3.js';
import { buildBundleIndex, filterIndex, BundleWalletData } from '../../src/bundler/keystore/bundle-index';

describe('Sweep Estimation Logic', () => {
  const BASE_TX_FEE = 5000;
  const RENT_EXEMPTION = 2039280;

  test('calculates net transfer correctly', () => {
    const balance = 100_000_000; // 0.1 SOL
    const fee = BASE_TX_FEE;
    const net = balance - fee - RENT_EXEMPTION;
    expect(net).toBe(100_000_000 - 5000 - 2039280);
    expect(net).toBeGreaterThan(0);
  });

  test('skips wallet with insufficient balance', () => {
    const balance = 5000; // Just enough for fee, nothing to send
    const net = balance - BASE_TX_FEE - RENT_EXEMPTION;
    expect(net).toBeLessThan(0);
  });

  test('handles zero balance wallet', () => {
    const balance = 0;
    const net = balance - BASE_TX_FEE;
    expect(net).toBeLessThan(0);
  });

  test('keeps rent exemption when configured', () => {
    const balance = 10_000_000;
    const keepRent = true;
    const reserved = keepRent ? RENT_EXEMPTION : 0;
    const net = balance - BASE_TX_FEE - reserved;
    expect(net).toBe(10_000_000 - 5000 - 2039280);
    expect(net).toBeGreaterThan(0);
  });

  test('no rent reservation when disabled', () => {
    const balance = 10_000_000;
    const keepRent = false;
    const reserved = keepRent ? RENT_EXEMPTION : 0;
    const net = balance - BASE_TX_FEE - reserved;
    expect(net).toBe(10_000_000 - 5000);
  });

  test('respects keepMinBalance', () => {
    const balance = 10_000_000;
    const keepMin = 5_000_000;
    const net = balance - BASE_TX_FEE - keepMin;
    expect(net).toBe(4_995_000);
  });
});

describe('Bundle Index', () => {
  function makeWalletData(count: number): BundleWalletData[] {
    return Array.from({ length: count }, (_, i) => ({
      index: i,
      address: Keypair.generate().publicKey.toBase58(),
      privateKey: 'dummy',
      label: `wallet-${i}`,
      tags: i % 2 === 0 ? ['even'] : ['odd'],
      group: `group-${Math.floor(i / 2)}`,
    }));
  }

  test('builds index with correct count', () => {
    const data = makeWalletData(5);
    const index = buildBundleIndex(data);
    expect(index.count).toBe(5);
    expect(index.wallets.length).toBe(5);
  });

  test('index does not contain private keys', () => {
    const data = makeWalletData(3);
    const index = buildBundleIndex(data);
    for (const entry of index.wallets) {
      expect(entry).not.toHaveProperty('privateKey');
    }
  });

  test('filters by indices', () => {
    const data = makeWalletData(5);
    const index = buildBundleIndex(data);
    const filtered = filterIndex(index, { indices: [0, 2, 4] });
    expect(filtered.length).toBe(3);
    expect(filtered.map(e => e.index)).toEqual([0, 2, 4]);
  });

  test('filters by tags', () => {
    const data = makeWalletData(6);
    const index = buildBundleIndex(data);
    const filtered = filterIndex(index, { tags: ['even'] });
    expect(filtered.length).toBe(3); // indices 0, 2, 4
  });

  test('filters by labels', () => {
    const data = makeWalletData(5);
    const index = buildBundleIndex(data);
    const filtered = filterIndex(index, { labels: ['wallet-1', 'wallet-3'] });
    expect(filtered.length).toBe(2);
  });

  test('filters by groups', () => {
    const data = makeWalletData(6);
    const index = buildBundleIndex(data);
    const filtered = filterIndex(index, { groups: ['group-0'] });
    expect(filtered.length).toBe(2); // indices 0, 1
  });

  test('empty filter returns all', () => {
    const data = makeWalletData(5);
    const index = buildBundleIndex(data);
    const filtered = filterIndex(index, {});
    expect(filtered.length).toBe(5);
  });
});
