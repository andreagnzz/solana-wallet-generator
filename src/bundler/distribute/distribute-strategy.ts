import { PublicKey } from '@solana/web3.js';

/** Distribution target */
export interface DistributeTarget {
  address: PublicKey;
  label?: string;
  amount?: number;
  weight?: number;
}

/** Distribution strategy types */
export type DistributeStrategy =
  | { type: 'equal'; totalAmount: number }
  | { type: 'weighted'; totalAmount: number }
  | { type: 'fixed' }
  | { type: 'random'; minAmount: number; maxAmount: number; totalAmount: number }
  | { type: 'fill-to'; targetBalance: number };

/** Calculated distribution per target */
export interface DistributionAllocation {
  address: PublicKey;
  label?: string;
  amount: number; // lamports or token units
}

/**
 * Calculate distribution amounts based on the chosen strategy
 */
export function calculateDistribution(
  targets: DistributeTarget[],
  strategy: DistributeStrategy,
  currentBalances?: Map<string, number>
): DistributionAllocation[] {
  switch (strategy.type) {
    case 'equal':
      return calculateEqual(targets, strategy.totalAmount);
    case 'weighted':
      return calculateWeighted(targets, strategy.totalAmount);
    case 'fixed':
      return calculateFixed(targets);
    case 'random':
      return calculateRandom(targets, strategy.minAmount, strategy.maxAmount, strategy.totalAmount);
    case 'fill-to':
      return calculateFillTo(targets, strategy.targetBalance, currentBalances);
    default:
      throw new Error('Unknown distribution strategy');
  }
}

/**
 * Equal distribution: divide total evenly among all targets.
 * Handles rounding by giving the remainder to the first targets.
 */
function calculateEqual(
  targets: DistributeTarget[],
  totalAmount: number
): DistributionAllocation[] {
  if (targets.length === 0) return [];

  const perTarget = Math.floor(totalAmount / targets.length);
  let remainder = totalAmount - perTarget * targets.length;

  return targets.map(t => {
    const extra = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - 1);
    return {
      address: t.address,
      label: t.label,
      amount: perTarget + extra,
    };
  });
}

/**
 * Weighted distribution: proportional to each target's weight.
 */
function calculateWeighted(
  targets: DistributeTarget[],
  totalAmount: number
): DistributionAllocation[] {
  const totalWeight = targets.reduce((sum, t) => sum + (t.weight || 1), 0);

  if (totalWeight === 0) {
    throw new Error('Total weight cannot be zero');
  }

  let allocated = 0;
  const allocations: DistributionAllocation[] = [];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const weight = t.weight || 1;

    let amount: number;
    if (i === targets.length - 1) {
      // Last target gets the remainder to avoid rounding issues
      amount = totalAmount - allocated;
    } else {
      amount = Math.floor((weight / totalWeight) * totalAmount);
    }

    allocated += amount;
    allocations.push({
      address: t.address,
      label: t.label,
      amount,
    });
  }

  return allocations;
}

/**
 * Fixed distribution: each target has a pre-set amount.
 */
function calculateFixed(targets: DistributeTarget[]): DistributionAllocation[] {
  return targets.map(t => {
    if (t.amount === undefined || t.amount <= 0) {
      throw new Error(`Target ${t.address.toBase58()} has no fixed amount set`);
    }
    return {
      address: t.address,
      label: t.label,
      amount: t.amount,
    };
  });
}

/**
 * Random distribution: random amounts between min and max, constrained to total.
 */
function calculateRandom(
  targets: DistributeTarget[],
  minAmount: number,
  maxAmount: number,
  totalAmount: number
): DistributionAllocation[] {
  if (minAmount * targets.length > totalAmount) {
    throw new Error('Total amount is too small for the minimum per target');
  }
  if (maxAmount * targets.length < totalAmount) {
    throw new Error('Total amount is too large for the maximum per target');
  }

  // Generate random proportions then scale to total
  const randoms = targets.map(() => minAmount + Math.random() * (maxAmount - minAmount));
  const randomTotal = randoms.reduce((a, b) => a + b, 0);
  const scale = totalAmount / randomTotal;

  let allocated = 0;
  const allocations: DistributionAllocation[] = [];

  for (let i = 0; i < targets.length; i++) {
    let amount: number;
    if (i === targets.length - 1) {
      amount = totalAmount - allocated;
    } else {
      amount = Math.floor(randoms[i] * scale);
      amount = Math.max(minAmount, Math.min(maxAmount, amount));
    }

    allocated += amount;
    allocations.push({
      address: targets[i].address,
      label: targets[i].label,
      amount,
    });
  }

  return allocations;
}

/**
 * Fill-to distribution: top up each target to reach a target balance.
 * Skips targets that are already at or above the target.
 */
function calculateFillTo(
  targets: DistributeTarget[],
  targetBalance: number,
  currentBalances?: Map<string, number>
): DistributionAllocation[] {
  return targets.map(t => {
    const current = currentBalances?.get(t.address.toBase58()) || 0;
    const needed = Math.max(0, targetBalance - current);

    return {
      address: t.address,
      label: t.label,
      amount: needed,
    };
  });
}

/**
 * Get the total amount required for a distribution
 */
export function getTotalRequired(allocations: DistributionAllocation[]): number {
  return allocations.reduce((sum, a) => sum + a.amount, 0);
}
