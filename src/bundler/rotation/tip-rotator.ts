import { PublicKey } from '@solana/web3.js';
import crypto from 'crypto';
import { JITO_TIP_ACCOUNTS } from '../jito/jito-client';

export interface TipRotatorConfig {
  readonly accounts: readonly PublicKey[];
  readonly minTipLamports: number;
  readonly maxTipLamports: number;
}

export interface TipSelection {
  readonly account: PublicKey;
  readonly lamports: number;
}

const DEFAULT_CONFIG: TipRotatorConfig = {
  accounts: JITO_TIP_ACCOUNTS,
  minTipLamports: 1_000,
  maxTipLamports: 100_000,
};

/**
 * Rotates Jito tip accounts and varies tip amounts to avoid detectable patterns.
 *
 * Guarantees:
 * - Never selects the same tip account consecutively
 * - Uniform distribution across all accounts over time
 * - Tip amounts vary within configured range using crypto-random
 */
export class TipRotator {
  private readonly config: TipRotatorConfig;
  private lastAccountIndex: number = -1;
  private readonly history: number[] = [];

  constructor(config: Partial<TipRotatorConfig> = {}) {
    this.config = {
      accounts: config.accounts ?? DEFAULT_CONFIG.accounts,
      minTipLamports: config.minTipLamports ?? DEFAULT_CONFIG.minTipLamports,
      maxTipLamports: config.maxTipLamports ?? DEFAULT_CONFIG.maxTipLamports,
    };

    if (this.config.accounts.length < 2) {
      throw new Error('TipRotator requires at least 2 tip accounts');
    }

    if (this.config.minTipLamports > this.config.maxTipLamports) {
      throw new Error('minTipLamports must be <= maxTipLamports');
    }
  }

  next(): TipSelection {
    const index = this.pickNonConsecutiveIndex();
    this.lastAccountIndex = index;
    this.history.push(index);

    return {
      account: this.config.accounts[index],
      lamports: this.randomLamports(),
    };
  }

  getHistory(): readonly number[] {
    return this.history;
  }

  getDistribution(): Map<number, number> {
    const dist = new Map<number, number>();
    for (const idx of this.history) {
      dist.set(idx, (dist.get(idx) ?? 0) + 1);
    }
    return dist;
  }

  reset(): void {
    this.lastAccountIndex = -1;
    this.history.length = 0;
  }

  private pickNonConsecutiveIndex(): number {
    const count = this.config.accounts.length;
    let index: number;
    do {
      index = this.cryptoRandomInt(count);
    } while (index === this.lastAccountIndex);
    return index;
  }

  private randomLamports(): number {
    const range = this.config.maxTipLamports - this.config.minTipLamports;
    if (range === 0) return this.config.minTipLamports;
    return this.config.minTipLamports + this.cryptoRandomInt(range + 1);
  }

  private cryptoRandomInt(max: number): number {
    const bytes = crypto.randomBytes(4);
    return bytes.readUInt32BE(0) % max;
  }
}
