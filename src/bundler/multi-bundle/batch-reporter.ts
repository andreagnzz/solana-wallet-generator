import { BatchBundleStatus } from './batch-monitor';
import { SequencerResult, SequencerMode } from './sequencer';

export interface BatchReport {
  readonly mode: SequencerMode;
  readonly totalBundles: number;
  readonly landed: number;
  readonly failed: number;
  readonly timeout: number;
  readonly successRate: string;
  readonly totalDurationMs: number;
  readonly aborted: boolean;
  readonly abortReason?: string;
  readonly items: BatchReportItem[];
}

export interface BatchReportItem {
  readonly id: string;
  readonly status: BatchBundleStatus;
}

/**
 * Formats sequencer results into structured reports.
 */
export function buildReport(result: SequencerResult): BatchReport {
  const items: BatchReportItem[] = [];
  for (const [id, status] of result.itemResults) {
    items.push({ id, status });
  }

  return {
    mode: result.mode,
    totalBundles: result.summary.total,
    landed: result.summary.landed,
    failed: result.summary.failed,
    timeout: result.summary.timeout,
    successRate: `${(result.summary.successRate * 100).toFixed(1)}%`,
    totalDurationMs: result.summary.totalDurationMs,
    aborted: result.aborted,
    abortReason: result.abortReason,
    items,
  };
}

export function formatReportText(report: BatchReport): string {
  const lines: string[] = [
    `Bundle Batch Report`,
    `-------------------`,
    `Mode:         ${report.mode}`,
    `Total:        ${report.totalBundles}`,
    `Landed:       ${report.landed}`,
    `Failed:       ${report.failed}`,
    `Timeout:      ${report.timeout}`,
    `Success Rate: ${report.successRate}`,
    `Duration:     ${report.totalDurationMs}ms`,
  ];

  if (report.aborted) {
    lines.push(`ABORTED:      ${report.abortReason}`);
  }

  if (report.items.length > 0) {
    lines.push('', 'Items:');
    for (const item of report.items) {
      const icon = item.status === 'landed' ? '+' : item.status === 'failed' ? 'x' : '?';
      lines.push(`  [${icon}] ${item.id}: ${item.status}`);
    }
  }

  return lines.join('\n');
}
