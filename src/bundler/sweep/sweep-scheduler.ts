import { Connection } from '@solana/web3.js';
import { SweepConfig, SweepResult, executeSweep } from './sweep-engine';

/** Types of sweep triggers */
export interface SweepTrigger {
  type: 'balance-threshold' | 'interval' | 'manual';
  thresholdLamports?: number;
  intervalMs?: number;
}

/** Callback types for scheduler events */
type SweepCompleteCallback = (result: SweepResult) => void;
type SweepErrorCallback = (error: Error) => void;

/**
 * Automatic sweep scheduler that monitors wallet balances
 * and triggers sweeps based on configurable conditions.
 */
export class SweepScheduler {
  private readonly connection: Connection;
  private readonly config: SweepConfig;
  private readonly trigger: SweepTrigger;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private onCompleteCallbacks: SweepCompleteCallback[] = [];
  private onErrorCallbacks: SweepErrorCallback[] = [];

  constructor(
    connection: Connection,
    config: SweepConfig,
    trigger: SweepTrigger
  ) {
    this.connection = connection;
    this.config = config;
    this.trigger = trigger;
  }

  /** Start the scheduler */
  start(): void {
    if (this.running) return;
    this.running = true;

    switch (this.trigger.type) {
      case 'interval':
        this.startIntervalTrigger();
        break;
      case 'balance-threshold':
        this.startThresholdTrigger();
        break;
      case 'manual':
        // Manual mode: do nothing, user calls triggerSweep()
        break;
    }
  }

  /** Stop the scheduler */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Register a callback for sweep completion */
  onSweepComplete(callback: SweepCompleteCallback): void {
    this.onCompleteCallbacks.push(callback);
  }

  /** Register a callback for sweep errors */
  onError(callback: SweepErrorCallback): void {
    this.onErrorCallbacks.push(callback);
  }

  /** Manually trigger a sweep */
  async triggerSweep(): Promise<SweepResult> {
    return this.doSweep();
  }

  /** Check if the scheduler is currently running */
  isRunning(): boolean {
    return this.running;
  }

  private startIntervalTrigger(): void {
    const interval = this.trigger.intervalMs || 60000;
    this.timer = setInterval(async () => {
      if (!this.running) return;
      try {
        await this.doSweep();
      } catch (err) {
        this.notifyError(err as Error);
      }
    }, interval);
  }

  private startThresholdTrigger(): void {
    const checkInterval = 10000; // Check every 10 seconds
    const threshold = this.trigger.thresholdLamports || 100000000; // 0.1 SOL default

    this.timer = setInterval(async () => {
      if (!this.running) return;
      try {
        const shouldSweep = await this.checkThreshold(threshold);
        if (shouldSweep) {
          await this.doSweep();
        }
      } catch (err) {
        this.notifyError(err as Error);
      }
    }, checkInterval);
  }

  private async checkThreshold(threshold: number): Promise<boolean> {
    for (const wallet of this.config.sourceWallets) {
      const balance = await this.connection.getBalance(wallet.keypair.publicKey);
      if (balance >= threshold) {
        return true;
      }
    }
    return false;
  }

  private async doSweep(): Promise<SweepResult> {
    const result = await executeSweep(this.connection, this.config);

    for (const cb of this.onCompleteCallbacks) {
      cb(result);
    }

    return result;
  }

  private notifyError(error: Error): void {
    for (const cb of this.onErrorCallbacks) {
      cb(error);
    }
  }
}
