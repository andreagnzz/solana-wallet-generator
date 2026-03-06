import { JitoClient } from '../jito/jito-client';
import { monitorBundle, BundleMonitorResult, MonitorOptions } from '../jito/jito-monitor';

export type BatchBundleStatus = 'queued' | 'pending' | 'landed' | 'failed' | 'timeout';

export interface BatchBundleEntry {
  readonly itemId: string;
  readonly bundleId: string;
  status: BatchBundleStatus;
  result?: BundleMonitorResult;
  submittedAt: number;
}

export interface BatchMonitorSummary {
  readonly total: number;
  readonly landed: number;
  readonly failed: number;
  readonly timeout: number;
  readonly pending: number;
  readonly successRate: number;
  readonly totalDurationMs: number;
}

/**
 * Monitors multiple submitted bundles, tracking their status
 * and producing a summary report.
 */
export class BatchMonitor {
  private readonly entries: Map<string, BatchBundleEntry> = new Map();
  private readonly client: JitoClient;
  private readonly monitorOptions: Partial<MonitorOptions>;
  private startTime: number = 0;

  constructor(client: JitoClient, monitorOptions: Partial<MonitorOptions> = {}) {
    this.client = client;
    this.monitorOptions = monitorOptions;
  }

  register(itemId: string, bundleId: string): void {
    if (this.startTime === 0) this.startTime = Date.now();

    this.entries.set(itemId, {
      itemId,
      bundleId,
      status: 'pending',
      submittedAt: Date.now(),
    });
  }

  async monitorAll(): Promise<BatchMonitorSummary> {
    const promises: Promise<void>[] = [];

    for (const [_id, entry] of this.entries) {
      if (entry.status === 'pending') {
        promises.push(this.monitorEntry(entry));
      }
    }

    await Promise.allSettled(promises);
    return this.getSummary();
  }

  async monitorOne(itemId: string): Promise<BundleMonitorResult | null> {
    const entry = this.entries.get(itemId);
    if (!entry) return null;

    await this.monitorEntry(entry);
    return entry.result ?? null;
  }

  getEntry(itemId: string): BatchBundleEntry | undefined {
    return this.entries.get(itemId);
  }

  getSummary(): BatchMonitorSummary {
    let landed = 0;
    let failed = 0;
    let timeout = 0;
    let pending = 0;

    for (const [_id, entry] of this.entries) {
      switch (entry.status) {
        case 'landed': landed++; break;
        case 'failed': failed++; break;
        case 'timeout': timeout++; break;
        default: pending++; break;
      }
    }

    const total = this.entries.size;
    return {
      total,
      landed,
      failed,
      timeout,
      pending,
      successRate: total > 0 ? landed / total : 0,
      totalDurationMs: Date.now() - this.startTime,
    };
  }

  getFailureRate(): number {
    const summary = this.getSummary();
    return summary.total > 0 ? (summary.failed + summary.timeout) / summary.total : 0;
  }

  reset(): void {
    this.entries.clear();
    this.startTime = 0;
  }

  private async monitorEntry(entry: BatchBundleEntry): Promise<void> {
    try {
      const result = await monitorBundle(
        entry.bundleId,
        this.client,
        this.monitorOptions
      );
      entry.result = result;
      entry.status = result.status as BatchBundleStatus;
    } catch {
      entry.status = 'failed';
    }
  }
}
