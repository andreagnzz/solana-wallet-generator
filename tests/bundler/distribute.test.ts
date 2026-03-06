import { Keypair } from '@solana/web3.js';
import {
  calculateDistribution,
  getTotalRequired,
  DistributeTarget,
} from '../../src/bundler/distribute/distribute-strategy';

function makeTargets(count: number): DistributeTarget[] {
  return Array.from({ length: count }, (_, i) => ({
    address: Keypair.generate().publicKey,
    label: `target-${i}`,
    weight: i + 1,
  }));
}

describe('Distribution Strategies', () => {
  describe('Equal strategy', () => {
    test('divides total equally', () => {
      const targets = makeTargets(4);
      const allocations = calculateDistribution(targets, {
        type: 'equal',
        totalAmount: 1000000,
      });

      expect(allocations.length).toBe(4);
      expect(allocations[0].amount).toBe(250000);
      expect(allocations[1].amount).toBe(250000);
      expect(allocations[2].amount).toBe(250000);
      expect(allocations[3].amount).toBe(250000);
      expect(getTotalRequired(allocations)).toBe(1000000);
    });

    test('handles remainder correctly', () => {
      const targets = makeTargets(3);
      const allocations = calculateDistribution(targets, {
        type: 'equal',
        totalAmount: 100,
      });

      // 100 / 3 = 33 remainder 1. First target gets +1
      expect(allocations[0].amount).toBe(34);
      expect(allocations[1].amount).toBe(33);
      expect(allocations[2].amount).toBe(33);
      expect(getTotalRequired(allocations)).toBe(100);
    });

    test('single target gets everything', () => {
      const targets = makeTargets(1);
      const allocations = calculateDistribution(targets, {
        type: 'equal',
        totalAmount: 500000,
      });

      expect(allocations[0].amount).toBe(500000);
    });
  });

  describe('Weighted strategy', () => {
    test('distributes proportionally to weights', () => {
      const targets: DistributeTarget[] = [
        { address: Keypair.generate().publicKey, weight: 1 },
        { address: Keypair.generate().publicKey, weight: 2 },
        { address: Keypair.generate().publicKey, weight: 7 },
      ];

      const allocations = calculateDistribution(targets, {
        type: 'weighted',
        totalAmount: 1000000,
      });

      // Weights: 1/10, 2/10, 7/10
      expect(allocations[0].amount).toBe(100000);
      expect(allocations[1].amount).toBe(200000);
      // Last gets remainder to ensure exact total
      expect(allocations[2].amount).toBe(700000);
      expect(getTotalRequired(allocations)).toBe(1000000);
    });

    test('default weight is 1', () => {
      const targets: DistributeTarget[] = [
        { address: Keypair.generate().publicKey },
        { address: Keypair.generate().publicKey },
      ];

      const allocations = calculateDistribution(targets, {
        type: 'weighted',
        totalAmount: 100,
      });

      expect(allocations[0].amount).toBe(50);
      expect(allocations[1].amount).toBe(50);
    });
  });

  describe('Fixed strategy', () => {
    test('uses preset amounts', () => {
      const targets: DistributeTarget[] = [
        { address: Keypair.generate().publicKey, amount: 100 },
        { address: Keypair.generate().publicKey, amount: 200 },
        { address: Keypair.generate().publicKey, amount: 300 },
      ];

      const allocations = calculateDistribution(targets, { type: 'fixed' });

      expect(allocations[0].amount).toBe(100);
      expect(allocations[1].amount).toBe(200);
      expect(allocations[2].amount).toBe(300);
      expect(getTotalRequired(allocations)).toBe(600);
    });

    test('throws if amount is missing', () => {
      const targets: DistributeTarget[] = [
        { address: Keypair.generate().publicKey },
      ];

      expect(() => calculateDistribution(targets, { type: 'fixed' })).toThrow();
    });
  });

  describe('Fill-to strategy', () => {
    test('calculates needed amounts', () => {
      const targets = makeTargets(3);
      const currentBalances = new Map<string, number>();
      currentBalances.set(targets[0].address.toBase58(), 50);
      currentBalances.set(targets[1].address.toBase58(), 100);
      currentBalances.set(targets[2].address.toBase58(), 200);

      const allocations = calculateDistribution(
        targets,
        { type: 'fill-to', targetBalance: 150 },
        currentBalances
      );

      expect(allocations[0].amount).toBe(100); // needs 100 more
      expect(allocations[1].amount).toBe(50);   // needs 50 more
      expect(allocations[2].amount).toBe(0);    // already above target
    });

    test('handles no current balances', () => {
      const targets = makeTargets(2);
      const allocations = calculateDistribution(targets, {
        type: 'fill-to',
        targetBalance: 1000,
      });

      // All need the full amount
      expect(allocations[0].amount).toBe(1000);
      expect(allocations[1].amount).toBe(1000);
    });
  });

  describe('Random strategy', () => {
    test('distributes within min/max bounds', () => {
      const targets = makeTargets(10);
      const allocations = calculateDistribution(targets, {
        type: 'random',
        minAmount: 100,
        maxAmount: 1000,
        totalAmount: 5000,
      });

      expect(allocations.length).toBe(10);
      expect(getTotalRequired(allocations)).toBe(5000);
    });

    test('throws if total too small', () => {
      const targets = makeTargets(10);
      expect(() =>
        calculateDistribution(targets, {
          type: 'random',
          minAmount: 1000,
          maxAmount: 2000,
          totalAmount: 100, // way too small
        })
      ).toThrow();
    });
  });
});
