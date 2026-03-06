import { Keypair } from '@solana/web3.js';
import crypto from 'crypto';

export interface SignerRotatorConfig {
  readonly cooldownSlots: number;
  readonly maxConsecutiveUses: number;
}

interface SignerEntry {
  readonly keypair: Keypair;
  readonly label: string;
  lastUsedSlot: number;
  consecutiveUses: number;
}

export interface SignerSelection {
  readonly keypair: Keypair;
  readonly label: string;
  readonly index: number;
}

const DEFAULT_CONFIG: SignerRotatorConfig = {
  cooldownSlots: 10,
  maxConsecutiveUses: 2,
};

/**
 * Rotates signing wallets to avoid linking bundles to a single fee payer.
 *
 * Enforces:
 * - Cooldown period: wallet not eligible until N slots after last use
 * - Max consecutive uses: cannot use the same wallet back-to-back too many times
 * - Crypto-random selection among eligible wallets
 */
export class SignerRotator {
  private readonly config: SignerRotatorConfig;
  private readonly signers: SignerEntry[] = [];
  private currentSlot: number = 0;
  private lastSelectedIndex: number = -1;

  constructor(config: Partial<SignerRotatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  addSigner(keypair: Keypair, label?: string): void {
    this.signers.push({
      keypair,
      label: label ?? keypair.publicKey.toBase58().substring(0, 8),
      lastUsedSlot: -Infinity,
      consecutiveUses: 0,
    });
  }

  addSigners(keypairs: Keypair[], labels?: string[]): void {
    for (let i = 0; i < keypairs.length; i++) {
      this.addSigner(keypairs[i], labels?.[i]);
    }
  }

  setCurrentSlot(slot: number): void {
    this.currentSlot = slot;
  }

  next(): SignerSelection {
    if (this.signers.length === 0) {
      throw new Error('No signers available');
    }

    const eligible = this.getEligibleIndices();

    if (eligible.length === 0) {
      // Fallback: pick least recently used
      return this.selectLeastRecentlyUsed();
    }

    const selectedIdx = eligible[this.cryptoRandomInt(eligible.length)];
    return this.select(selectedIdx);
  }

  getSignerCount(): number {
    return this.signers.length;
  }

  getEligibleCount(): number {
    return this.getEligibleIndices().length;
  }

  reset(): void {
    for (const entry of this.signers) {
      entry.lastUsedSlot = -Infinity;
      entry.consecutiveUses = 0;
    }
    this.lastSelectedIndex = -1;
    this.currentSlot = 0;
  }

  private getEligibleIndices(): number[] {
    const eligible: number[] = [];
    for (let i = 0; i < this.signers.length; i++) {
      const entry = this.signers[i];
      const slotsSinceUse = this.currentSlot - entry.lastUsedSlot;
      const cooldownMet = slotsSinceUse >= this.config.cooldownSlots;
      const notOverused = i !== this.lastSelectedIndex ||
        entry.consecutiveUses < this.config.maxConsecutiveUses;

      if (cooldownMet && notOverused) {
        eligible.push(i);
      }
    }
    return eligible;
  }

  private selectLeastRecentlyUsed(): SignerSelection {
    let bestIdx = 0;
    let bestSlot = Infinity;
    for (let i = 0; i < this.signers.length; i++) {
      if (this.signers[i].lastUsedSlot < bestSlot) {
        bestSlot = this.signers[i].lastUsedSlot;
        bestIdx = i;
      }
    }
    return this.select(bestIdx);
  }

  private select(index: number): SignerSelection {
    const entry = this.signers[index];

    if (index === this.lastSelectedIndex) {
      entry.consecutiveUses++;
    } else {
      entry.consecutiveUses = 1;
    }

    entry.lastUsedSlot = this.currentSlot;
    this.lastSelectedIndex = index;

    return {
      keypair: entry.keypair,
      label: entry.label,
      index,
    };
  }

  private cryptoRandomInt(max: number): number {
    const bytes = crypto.randomBytes(4);
    return bytes.readUInt32BE(0) % max;
  }
}
