import { VersionedTransaction } from '@solana/web3.js';

export interface BatchItem {
  readonly id: string;
  readonly transactions: VersionedTransaction[];
  readonly tipLamports: number;
  readonly metadata?: Record<string, unknown>;
}

export interface BatchConfig {
  readonly maxBundleSize: number;
  readonly label?: string;
}

const DEFAULT_MAX_BUNDLE_SIZE = 5;

/**
 * Builds batches of bundles for sequential or pipelined submission.
 *
 * Groups pre-built transactions into indexed BatchItems that can be
 * submitted by the BundleSequencer.
 */
export class BatchBuilder {
  private readonly items: BatchItem[] = [];
  private readonly config: BatchConfig;

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = {
      maxBundleSize: config.maxBundleSize ?? DEFAULT_MAX_BUNDLE_SIZE,
      label: config.label,
    };
  }

  add(
    transactions: VersionedTransaction[],
    tipLamports: number,
    metadata?: Record<string, unknown>
  ): string {
    if (transactions.length === 0) {
      throw new Error('Bundle must contain at least one transaction');
    }
    if (transactions.length > this.config.maxBundleSize) {
      throw new Error(
        `Bundle exceeds max size: ${transactions.length} > ${this.config.maxBundleSize}`
      );
    }

    const id = `batch-${this.items.length}-${Date.now()}`;
    this.items.push({ id, transactions, tipLamports, metadata });
    return id;
  }

  getItems(): readonly BatchItem[] {
    return this.items;
  }

  getItem(index: number): BatchItem | undefined {
    return this.items[index];
  }

  size(): number {
    return this.items.length;
  }

  totalTipLamports(): number {
    return this.items.reduce((sum, item) => sum + item.tipLamports, 0);
  }

  clear(): void {
    this.items.length = 0;
  }
}
