import { JitoClient, BundleStatusResult } from './jito-client';

/** Bundle monitoring status */
export type BundleMonitorStatus = 'pending' | 'landed' | 'failed' | 'timeout' | 'invalid';

/** Final result of bundle monitoring */
export interface BundleMonitorResult {
  bundleId: string;
  status: BundleMonitorStatus;
  slot?: number;
  error?: string;
  attempts: number;
  durationMs: number;
}

/** Options for bundle monitoring */
export interface MonitorOptions {
  pollIntervalMs: number;
  timeoutMs: number;
  onStatusChange?: (status: BundleMonitorStatus) => void;
  onLanded?: (slot: number) => void;
  onFailed?: (reason: string) => void;
}

const DEFAULT_POLL_INTERVAL = 1000;
const DEFAULT_TIMEOUT = 60000; // 30 slots ~ 60 seconds

/**
 * Monitor a submitted Jito bundle until it lands, fails, or times out.
 *
 * Polls the Jito API at regular intervals to check bundle status.
 * Calls back on status changes for real-time updates.
 *
 * @param bundleId - The bundle ID returned from sendBundle
 * @param client - JitoClient instance
 * @param options - Monitoring options
 * @returns Final bundle result
 */
export async function monitorBundle(
  bundleId: string,
  client: JitoClient,
  options: Partial<MonitorOptions> = {}
): Promise<BundleMonitorResult> {
  const pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const startTime = Date.now();
  let attempts = 0;
  let lastStatus: BundleMonitorStatus = 'pending';

  while (Date.now() - startTime < timeout) {
    attempts++;

    const status = await client.getBundleStatus(bundleId);

    if (status) {
      const currentStatus = mapToMonitorStatus(status);

      // Notify on status change
      if (currentStatus !== lastStatus && options.onStatusChange) {
        options.onStatusChange(currentStatus);
      }
      lastStatus = currentStatus;

      if (currentStatus === 'landed') {
        if (options.onLanded && status.landedSlot) {
          options.onLanded(status.landedSlot);
        }
        return {
          bundleId,
          status: 'landed',
          slot: status.landedSlot,
          attempts,
          durationMs: Date.now() - startTime,
        };
      }

      if (currentStatus === 'failed') {
        const reason = status.error || 'Bundle rejected by block engine';
        if (options.onFailed) {
          options.onFailed(reason);
        }
        return {
          bundleId,
          status: 'failed',
          error: reason,
          attempts,
          durationMs: Date.now() - startTime,
        };
      }

      if (currentStatus === 'invalid') {
        return {
          bundleId,
          status: 'invalid',
          error: 'Bundle ID not recognized',
          attempts,
          durationMs: Date.now() - startTime,
        };
      }
    }

    // Wait before next poll
    await sleep(pollInterval);
  }

  // Timeout
  return {
    bundleId,
    status: 'timeout',
    error: `Bundle did not land within ${timeout}ms`,
    attempts,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Monitor multiple bundles in parallel
 */
export async function monitorBundles(
  bundleIds: string[],
  client: JitoClient,
  options: Partial<MonitorOptions> = {}
): Promise<BundleMonitorResult[]> {
  return Promise.all(
    bundleIds.map(id => monitorBundle(id, client, options))
  );
}

/** Map Jito status to our monitor status */
function mapToMonitorStatus(status: BundleStatusResult): BundleMonitorStatus {
  switch (status.status) {
    case 'Landed':
      return 'landed';
    case 'Pending':
      return 'pending';
    case 'Failed':
      return 'failed';
    case 'Invalid':
      return 'invalid';
    default:
      return 'pending';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
