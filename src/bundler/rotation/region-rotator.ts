import crypto from 'crypto';
import { JitoRegion, JITO_ENDPOINTS } from '../jito/jito-client';

export interface RegionRotatorConfig {
  readonly regions: readonly JitoRegion[];
  readonly enableLatencyTracking: boolean;
}

export interface RegionSelection {
  readonly region: JitoRegion;
  readonly endpoint: string;
}

export interface RegionStats {
  readonly region: JitoRegion;
  readonly useCount: number;
  readonly avgLatencyMs: number;
}

const DEFAULT_REGIONS: readonly JitoRegion[] = [
  'mainnet', 'amsterdam', 'frankfurt', 'ny', 'tokyo',
];

/**
 * Rotates Jito regions to distribute bundle submissions geographically.
 *
 * Avoids submitting too many bundles to the same region consecutively,
 * reducing the chance of pattern detection by block engine analytics.
 */
export class RegionRotator {
  private readonly config: RegionRotatorConfig;
  private lastRegionIndex: number = -1;
  private readonly useCounts: Map<JitoRegion, number> = new Map();
  private readonly latencies: Map<JitoRegion, number[]> = new Map();

  constructor(config: Partial<RegionRotatorConfig> = {}) {
    this.config = {
      regions: config.regions ?? DEFAULT_REGIONS,
      enableLatencyTracking: config.enableLatencyTracking ?? false,
    };

    if (this.config.regions.length < 2) {
      throw new Error('RegionRotator requires at least 2 regions');
    }

    for (const region of this.config.regions) {
      this.useCounts.set(region, 0);
      this.latencies.set(region, []);
    }
  }

  next(): RegionSelection {
    const count = this.config.regions.length;
    let index: number;
    do {
      index = this.cryptoRandomInt(count);
    } while (index === this.lastRegionIndex);

    this.lastRegionIndex = index;
    const region = this.config.regions[index];
    this.useCounts.set(region, (this.useCounts.get(region) ?? 0) + 1);

    return {
      region,
      endpoint: JITO_ENDPOINTS[region],
    };
  }

  recordLatency(region: JitoRegion, latencyMs: number): void {
    if (!this.config.enableLatencyTracking) return;
    const arr = this.latencies.get(region);
    if (arr) {
      arr.push(latencyMs);
      // Keep last 50 measurements
      if (arr.length > 50) arr.shift();
    }
  }

  getStats(): RegionStats[] {
    return this.config.regions.map(region => {
      const latencyArr = this.latencies.get(region) ?? [];
      const avgLatency = latencyArr.length > 0
        ? Math.round(latencyArr.reduce((a, b) => a + b, 0) / latencyArr.length)
        : 0;

      return {
        region,
        useCount: this.useCounts.get(region) ?? 0,
        avgLatencyMs: avgLatency,
      };
    });
  }

  reset(): void {
    this.lastRegionIndex = -1;
    for (const region of this.config.regions) {
      this.useCounts.set(region, 0);
      this.latencies.set(region, []);
    }
  }

  private cryptoRandomInt(max: number): number {
    const bytes = crypto.randomBytes(4);
    return bytes.readUInt32BE(0) % max;
  }
}
