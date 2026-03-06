import bs58 from 'bs58';
import { JitoClient, BundleSubmissionResult } from '../jito/jito-client';
import { BatchBuilder, BatchItem } from './batch-builder';
import { BatchMonitor, BatchMonitorSummary, BatchBundleStatus } from './batch-monitor';
import { MonitorOptions } from '../jito/jito-monitor';

export type SequencerMode = 'sequential' | 'pipelined' | 'adaptive';

export interface SequencerConfig {
  readonly mode: SequencerMode;
  readonly adaptiveFailureThreshold: number;
  readonly abortOnCriticalFailure: boolean;
  readonly maxCriticalFailures: number;
  readonly onBundleSent?: (itemId: string, bundleId: string) => void;
  readonly onBundleLanded?: (itemId: string, slot: number) => void;
  readonly onBundleFailed?: (itemId: string, error: string) => void;
  readonly monitorOptions?: Partial<MonitorOptions>;
}

export interface SequencerResult {
  readonly mode: SequencerMode;
  readonly summary: BatchMonitorSummary;
  readonly aborted: boolean;
  readonly abortReason?: string;
  readonly itemResults: Map<string, BatchBundleStatus>;
}

const DEFAULT_CONFIG: SequencerConfig = {
  mode: 'sequential',
  adaptiveFailureThreshold: 0.3,
  abortOnCriticalFailure: true,
  maxCriticalFailures: 2,
};

/**
 * Submits batches of bundles in different execution modes:
 *
 * - **sequential**: Bundle N+1 is not sent until bundle N lands or fails
 * - **pipelined**: All bundles sent immediately, monitored in parallel
 * - **adaptive**: Starts pipelined, switches to sequential after threshold failures
 */
export class BundleSequencer {
  private readonly config: SequencerConfig;
  private readonly client: JitoClient;
  private monitor: BatchMonitor;

  constructor(client: JitoClient, config: Partial<SequencerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = client;
    this.monitor = new BatchMonitor(client, config.monitorOptions);
  }

  async execute(batch: BatchBuilder): Promise<SequencerResult> {
    const items = batch.getItems();
    if (items.length === 0) {
      return this.emptyResult();
    }

    this.monitor.reset();
    const effectiveMode = this.config.mode;

    switch (effectiveMode) {
      case 'sequential':
        return this.executeSequential(items);
      case 'pipelined':
        return this.executePipelined(items);
      case 'adaptive':
        return this.executeAdaptive(items);
      default:
        return this.executeSequential(items);
    }
  }

  private async executeSequential(items: readonly BatchItem[]): Promise<SequencerResult> {
    let criticalFailures = 0;
    const itemResults = new Map<string, BatchBundleStatus>();

    for (const item of items) {
      const bundleId = await this.submitBundle(item);
      if (!bundleId) {
        itemResults.set(item.id, 'failed');
        criticalFailures++;

        if (this.shouldAbort(criticalFailures)) {
          return this.abortedResult('sequential', itemResults,
            `Aborted after ${criticalFailures} critical failures`);
        }
        continue;
      }

      this.monitor.register(item.id, bundleId);
      this.config.onBundleSent?.(item.id, bundleId);

      const result = await this.monitor.monitorOne(item.id);

      if (result) {
        const status = result.status as BatchBundleStatus;
        itemResults.set(item.id, status);

        if (status === 'landed' && result.slot) {
          this.config.onBundleLanded?.(item.id, result.slot);
        } else if (status === 'failed' || status === 'timeout') {
          this.config.onBundleFailed?.(item.id, result.error ?? 'Unknown');
          criticalFailures++;

          if (this.shouldAbort(criticalFailures)) {
            return this.abortedResult('sequential', itemResults,
              `Aborted after ${criticalFailures} critical failures`);
          }
        }
      }
    }

    return {
      mode: 'sequential',
      summary: this.monitor.getSummary(),
      aborted: false,
      itemResults,
    };
  }

  private async executePipelined(items: readonly BatchItem[]): Promise<SequencerResult> {
    const itemResults = new Map<string, BatchBundleStatus>();

    // Submit all bundles immediately
    for (const item of items) {
      const bundleId = await this.submitBundle(item);
      if (!bundleId) {
        itemResults.set(item.id, 'failed');
        continue;
      }
      this.monitor.register(item.id, bundleId);
      this.config.onBundleSent?.(item.id, bundleId);
    }

    // Monitor all in parallel
    const summary = await this.monitor.monitorAll();

    // Collect results
    for (const item of items) {
      if (!itemResults.has(item.id)) {
        const entry = this.monitor.getEntry(item.id);
        const status = entry?.status ?? 'failed';
        itemResults.set(item.id, status);

        if (status === 'landed' && entry?.result?.slot) {
          this.config.onBundleLanded?.(item.id, entry.result.slot);
        } else if (status === 'failed' || status === 'timeout') {
          this.config.onBundleFailed?.(item.id, entry?.result?.error ?? 'Unknown');
        }
      }
    }

    return {
      mode: 'pipelined',
      summary,
      aborted: false,
      itemResults,
    };
  }

  private async executeAdaptive(items: readonly BatchItem[]): Promise<SequencerResult> {
    let criticalFailures = 0;
    let useSequential = false;
    const itemResults = new Map<string, BatchBundleStatus>();
    const pendingIds: string[] = [];

    for (const item of items) {
      const bundleId = await this.submitBundle(item);
      if (!bundleId) {
        itemResults.set(item.id, 'failed');
        criticalFailures++;
        continue;
      }

      this.monitor.register(item.id, bundleId);
      this.config.onBundleSent?.(item.id, bundleId);

      if (useSequential) {
        // Sequential mode: wait for each
        const result = await this.monitor.monitorOne(item.id);
        if (result) {
          const status = result.status as BatchBundleStatus;
          itemResults.set(item.id, status);
          if (status === 'failed' || status === 'timeout') criticalFailures++;
        }
      } else {
        pendingIds.push(item.id);
      }

      // Check if we should switch to sequential
      const failureRate = this.monitor.getFailureRate();
      if (!useSequential && failureRate >= this.config.adaptiveFailureThreshold) {
        useSequential = true;

        // Monitor any remaining pending bundles
        if (pendingIds.length > 0) {
          await this.monitor.monitorAll();
          for (const id of pendingIds) {
            const entry = this.monitor.getEntry(id);
            if (entry && !itemResults.has(id)) {
              itemResults.set(id, entry.status);
              if (entry.status === 'failed' || entry.status === 'timeout') {
                criticalFailures++;
              }
            }
          }
          pendingIds.length = 0;
        }
      }

      if (this.shouldAbort(criticalFailures)) {
        return this.abortedResult('adaptive', itemResults,
          `Aborted after ${criticalFailures} critical failures`);
      }
    }

    // Monitor any remaining pipelined bundles
    if (pendingIds.length > 0) {
      await this.monitor.monitorAll();
      for (const id of pendingIds) {
        const entry = this.monitor.getEntry(id);
        if (entry && !itemResults.has(id)) {
          itemResults.set(id, entry.status);
        }
      }
    }

    return {
      mode: 'adaptive',
      summary: this.monitor.getSummary(),
      aborted: false,
      itemResults,
    };
  }

  private async submitBundle(item: BatchItem): Promise<string | null> {
    try {
      const serialized = item.transactions.map(tx =>
        bs58.encode(Buffer.from(tx.serialize()))
      );
      const response: BundleSubmissionResult = await this.client.sendBundle(serialized);

      if (response.error) return null;
      return response.result ?? null;
    } catch {
      return null;
    }
  }

  private shouldAbort(criticalFailures: number): boolean {
    return this.config.abortOnCriticalFailure &&
      criticalFailures >= this.config.maxCriticalFailures;
  }

  private emptyResult(): SequencerResult {
    return {
      mode: this.config.mode,
      summary: {
        total: 0, landed: 0, failed: 0, timeout: 0, pending: 0,
        successRate: 0, totalDurationMs: 0,
      },
      aborted: false,
      itemResults: new Map(),
    };
  }

  private abortedResult(
    mode: SequencerMode,
    itemResults: Map<string, BatchBundleStatus>,
    reason: string
  ): SequencerResult {
    return {
      mode,
      summary: this.monitor.getSummary(),
      aborted: true,
      abortReason: reason,
      itemResults,
    };
  }
}
