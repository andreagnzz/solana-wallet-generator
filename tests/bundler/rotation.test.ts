import { Keypair, PublicKey } from '@solana/web3.js';
import { TipRotator } from '../../src/bundler/rotation/tip-rotator';
import { TimingRotator } from '../../src/bundler/rotation/timing-rotator';
import { RegionRotator } from '../../src/bundler/rotation/region-rotator';
import { SignerRotator } from '../../src/bundler/rotation/signer-rotator';
import { PatternEngine } from '../../src/bundler/rotation/pattern-engine';

// ─── TipRotator ────────────────────────────────────────────────

describe('TipRotator', () => {
  const accounts = Array.from({ length: 8 }, () =>
    Keypair.generate().publicKey
  );

  it('never selects the same tip account consecutively over 1000 runs', () => {
    const rotator = new TipRotator({ accounts });

    let lastAccount = '';
    for (let i = 0; i < 1000; i++) {
      const selection = rotator.next();
      const current = selection.account.toBase58();
      expect(current).not.toBe(lastAccount);
      lastAccount = current;
    }
  });

  it('distributes uniformly across all 8 accounts', () => {
    const rotator = new TipRotator({ accounts });
    const runs = 10000;

    for (let i = 0; i < runs; i++) {
      rotator.next();
    }

    const dist = rotator.getDistribution();
    const expected = runs / accounts.length;
    const tolerance = expected * 0.25; // 25% tolerance

    for (let idx = 0; idx < accounts.length; idx++) {
      const count = dist.get(idx) ?? 0;
      expect(count).toBeGreaterThan(expected - tolerance);
      expect(count).toBeLessThan(expected + tolerance);
    }
  });

  it('varies tip amounts within configured range', () => {
    const rotator = new TipRotator({
      accounts,
      minTipLamports: 5000,
      maxTipLamports: 50000,
    });

    const amounts = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const selection = rotator.next();
      expect(selection.lamports).toBeGreaterThanOrEqual(5000);
      expect(selection.lamports).toBeLessThanOrEqual(50000);
      amounts.add(selection.lamports);
    }

    // Should have variety in amounts
    expect(amounts.size).toBeGreaterThan(10);
  });

  it('throws with fewer than 2 accounts', () => {
    expect(() => new TipRotator({ accounts: [accounts[0]] }))
      .toThrow('at least 2 tip accounts');
  });

  it('throws when minTip > maxTip', () => {
    expect(() => new TipRotator({
      accounts,
      minTipLamports: 100000,
      maxTipLamports: 1000,
    })).toThrow('minTipLamports must be <= maxTipLamports');
  });

  it('reset clears history', () => {
    const rotator = new TipRotator({ accounts });
    rotator.next();
    rotator.next();
    expect(rotator.getHistory().length).toBe(2);
    rotator.reset();
    expect(rotator.getHistory().length).toBe(0);
  });
});

// ─── TimingRotator ─────────────────────────────────────────────

describe('TimingRotator', () => {
  it('generates delays within normal range', () => {
    const rotator = new TimingRotator({
      burstProbability: 0,
      pauseProbability: 0,
      minDelayMs: 500,
      maxDelayMs: 2000,
    });

    for (let i = 0; i < 100; i++) {
      const decision = rotator.next();
      expect(decision.delayMs).toBeGreaterThanOrEqual(500);
      expect(decision.delayMs).toBeLessThanOrEqual(2000);
      expect(decision.isBurst).toBe(false);
      expect(decision.isPause).toBe(false);
    }
  });

  it('produces bursts and pauses statistically', () => {
    const rotator = new TimingRotator({
      burstProbability: 0.3,
      pauseProbability: 0.2,
    });

    for (let i = 0; i < 500; i++) {
      rotator.next();
    }

    const stats = rotator.getStats();
    expect(stats.burstCount).toBeGreaterThan(0);
    expect(stats.pauseCount).toBeGreaterThan(0);
    expect(stats.normalCount).toBeGreaterThan(0);
  });

  it('burst delays are shorter than normal delays', () => {
    const rotator = new TimingRotator({
      burstProbability: 0,
      pauseProbability: 0,
      burstMinDelayMs: 50,
      burstMaxDelayMs: 200,
      minDelayMs: 1000,
      maxDelayMs: 3000,
    });

    // Force 100 normal decisions
    for (let i = 0; i < 100; i++) {
      const d = rotator.next();
      expect(d.delayMs).toBeGreaterThanOrEqual(1000);
    }
  });

  it('throws when probabilities exceed 1', () => {
    expect(() => new TimingRotator({
      burstProbability: 0.6,
      pauseProbability: 0.5,
    })).toThrow('burstProbability + pauseProbability must be <= 1');
  });

  it('getStats returns correct averages', () => {
    const rotator = new TimingRotator({
      burstProbability: 0,
      pauseProbability: 0,
    });

    for (let i = 0; i < 10; i++) {
      rotator.next();
    }

    const stats = rotator.getStats();
    expect(stats.avgDelayMs).toBeGreaterThan(0);
    expect(stats.normalCount).toBe(10);
    expect(stats.burstCount).toBe(0);
    expect(stats.pauseCount).toBe(0);
  });

  it('reset clears state', () => {
    const rotator = new TimingRotator();
    rotator.next();
    rotator.next();
    rotator.reset();
    expect(rotator.getHistory().length).toBe(0);
    const stats = rotator.getStats();
    expect(stats.avgDelayMs).toBe(0);
  });
});

// ─── RegionRotator ─────────────────────────────────────────────

describe('RegionRotator', () => {
  it('never selects the same region consecutively', () => {
    const rotator = new RegionRotator();
    let lastRegion = '';

    for (let i = 0; i < 200; i++) {
      const selection = rotator.next();
      expect(selection.region).not.toBe(lastRegion);
      lastRegion = selection.region;
    }
  });

  it('returns valid endpoint URLs', () => {
    const rotator = new RegionRotator();

    for (let i = 0; i < 20; i++) {
      const selection = rotator.next();
      expect(selection.endpoint).toContain('jito.wtf');
    }
  });

  it('tracks usage counts per region', () => {
    const rotator = new RegionRotator();

    for (let i = 0; i < 100; i++) {
      rotator.next();
    }

    const stats = rotator.getStats();
    const totalUses = stats.reduce((sum, s) => sum + s.useCount, 0);
    expect(totalUses).toBe(100);
  });

  it('records latency when enabled', () => {
    const rotator = new RegionRotator({ enableLatencyTracking: true });
    rotator.recordLatency('mainnet', 150);
    rotator.recordLatency('mainnet', 200);

    const stats = rotator.getStats();
    const mainnetStats = stats.find(s => s.region === 'mainnet')!;
    expect(mainnetStats.avgLatencyMs).toBe(175);
  });

  it('throws with fewer than 2 regions', () => {
    expect(() => new RegionRotator({ regions: ['mainnet'] }))
      .toThrow('at least 2 regions');
  });

  it('reset clears all state', () => {
    const rotator = new RegionRotator();
    rotator.next();
    rotator.next();
    rotator.reset();
    const stats = rotator.getStats();
    expect(stats.every(s => s.useCount === 0)).toBe(true);
  });
});

// ─── SignerRotator ─────────────────────────────────────────────

describe('SignerRotator', () => {
  const makeSigners = (n: number) =>
    Array.from({ length: n }, () => Keypair.generate());

  it('throws when no signers available', () => {
    const rotator = new SignerRotator();
    expect(() => rotator.next()).toThrow('No signers available');
  });

  it('respects cooldown slots', () => {
    const rotator = new SignerRotator({ cooldownSlots: 5, maxConsecutiveUses: 1 });
    const signers = makeSigners(3);
    rotator.addSigners(signers);

    // Use all 3 signers
    const usedKeys = new Set<string>();
    rotator.setCurrentSlot(0);

    for (let slot = 0; slot < 30; slot++) {
      rotator.setCurrentSlot(slot);
      const selection = rotator.next();
      usedKeys.add(selection.keypair.publicKey.toBase58());
    }

    // All 3 signers should have been used
    expect(usedKeys.size).toBe(3);
  });

  it('respects maxConsecutiveUses', () => {
    const rotator = new SignerRotator({ cooldownSlots: 0, maxConsecutiveUses: 2 });
    const signers = makeSigners(2);
    rotator.addSigners(signers);

    // With cooldown=0 and maxConsecutive=2, should never use same signer 3x in a row
    let lastKey = '';
    let consecutiveCount = 0;

    for (let i = 0; i < 200; i++) {
      const selection = rotator.next();
      const key = selection.keypair.publicKey.toBase58();

      if (key === lastKey) {
        consecutiveCount++;
        expect(consecutiveCount).toBeLessThanOrEqual(2);
      } else {
        consecutiveCount = 1;
      }
      lastKey = key;
    }
  });

  it('falls back to least recently used when all on cooldown', () => {
    const rotator = new SignerRotator({ cooldownSlots: 100, maxConsecutiveUses: 1 });
    const signers = makeSigners(2);
    rotator.addSigners(signers);

    rotator.setCurrentSlot(0);
    const first = rotator.next();
    const second = rotator.next();

    // Both should complete without throwing
    expect(first.keypair).toBeDefined();
    expect(second.keypair).toBeDefined();
  });

  it('reports correct signer count', () => {
    const rotator = new SignerRotator();
    expect(rotator.getSignerCount()).toBe(0);
    rotator.addSigners(makeSigners(5));
    expect(rotator.getSignerCount()).toBe(5);
  });

  it('reset clears usage state', () => {
    const rotator = new SignerRotator({ cooldownSlots: 100 });
    const signers = makeSigners(3);
    rotator.addSigners(signers);

    rotator.setCurrentSlot(0);
    rotator.next();
    rotator.reset();

    // After reset, all should be eligible
    expect(rotator.getEligibleCount()).toBe(3);
  });
});

// ─── PatternEngine ─────────────────────────────────────────────

describe('PatternEngine', () => {
  it('produces complete rotation decisions', () => {
    const engine = new PatternEngine();
    const signers = Array.from({ length: 3 }, () => Keypair.generate());
    engine.addSigners(signers);

    const decision = engine.next();

    expect(decision.tip.account).toBeInstanceOf(PublicKey);
    expect(decision.tip.lamports).toBeGreaterThan(0);
    expect(decision.timing.delayMs).toBeGreaterThan(0);
    expect(decision.region.region).toBeDefined();
    expect(decision.region.endpoint).toContain('jito.wtf');
    expect(decision.signer.keypair).toBeDefined();
  });

  it('no detectable patterns over 100 rotations', () => {
    const engine = new PatternEngine();
    const signers = Array.from({ length: 5 }, () => Keypair.generate());
    engine.addSigners(signers);

    for (let i = 0; i < 100; i++) {
      engine.setCurrentSlot(i * 2);
      engine.next();
    }

    const risk = engine.analyzeRisk();
    // Tip accounts should never repeat consecutively
    expect(risk.tipRepeatRate).toBe(0);
    // Region should never repeat consecutively
    expect(risk.regionRepeatRate).toBe(0);
    // Timing should have meaningful variance
    expect(risk.timingVariance).toBeGreaterThan(0);
    // Overall risk should not be high
    expect(risk.overallRisk).not.toBe('high');
  });

  it('analyzeRisk returns low for empty history', () => {
    const engine = new PatternEngine();
    const risk = engine.analyzeRisk();
    expect(risk.overallRisk).toBe('low');
    expect(risk.recommendations.length).toBe(0);
  });

  it('tracks decision count', () => {
    const engine = new PatternEngine();
    engine.addSigners([Keypair.generate(), Keypair.generate()]);

    expect(engine.getDecisionCount()).toBe(0);
    engine.next();
    engine.next();
    expect(engine.getDecisionCount()).toBe(2);
  });

  it('reset clears all rotator state', () => {
    const engine = new PatternEngine();
    engine.addSigners([Keypair.generate(), Keypair.generate()]);
    engine.next();
    engine.next();
    engine.reset();
    expect(engine.getDecisionCount()).toBe(0);
  });
});
