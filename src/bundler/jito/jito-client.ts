import axios, { AxiosInstance } from 'axios';
import { Keypair, PublicKey } from '@solana/web3.js';

/** Jito Block Engine regions */
export type JitoRegion = 'mainnet' | 'amsterdam' | 'frankfurt' | 'ny' | 'tokyo';

/** Jito endpoints by region */
export const JITO_ENDPOINTS: Record<JitoRegion, string> = {
  mainnet: 'https://mainnet.block-engine.jito.wtf',
  amsterdam: 'https://amsterdam.mainnet.block-engine.jito.wtf',
  frankfurt: 'https://frankfurt.mainnet.block-engine.jito.wtf',
  ny: 'https://ny.mainnet.block-engine.jito.wtf',
  tokyo: 'https://tokyo.mainnet.block-engine.jito.wtf',
};

/** Jito client configuration */
export interface JitoClientConfig {
  region: JitoRegion;
  authKeypair?: Keypair;
  timeout: number;
  fallbackRegions: JitoRegion[];
}

/** Bundle submission response */
export interface BundleSubmissionResult {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: {
    code: number;
    message: string;
  };
}

/** Bundle status response */
export interface BundleStatusResult {
  bundleId: string;
  status: 'Invalid' | 'Pending' | 'Failed' | 'Landed';
  landedSlot?: number;
  error?: string;
}

/**
 * Client for interacting with Jito Block Engine.
 *
 * Supports:
 * - REST API for bundle submission and status queries
 * - Multi-region failover with configurable timeout
 * - Rate limiting (max 5 bundles/s per IP without auth)
 */
export class JitoClient {
  private readonly config: JitoClientConfig;
  private httpClient: AxiosInstance;
  private currentRegion: JitoRegion;

  constructor(config: Partial<JitoClientConfig> = {}) {
    this.config = {
      region: config.region || 'mainnet',
      authKeypair: config.authKeypair,
      timeout: config.timeout || 5000,
      fallbackRegions: config.fallbackRegions || ['amsterdam', 'frankfurt', 'ny', 'tokyo'],
    };

    this.currentRegion = this.config.region;
    this.httpClient = this.createHttpClient(this.currentRegion);
  }

  /** Get the current endpoint URL */
  getEndpoint(): string {
    return JITO_ENDPOINTS[this.currentRegion];
  }

  /** Get the current region */
  getRegion(): JitoRegion {
    return this.currentRegion;
  }

  /**
   * Submit a bundle of base58-encoded transactions
   */
  async sendBundle(serializedTransactions: string[]): Promise<BundleSubmissionResult> {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'sendBundle',
      params: [serializedTransactions],
    };

    try {
      const response = await this.httpClient.post('/api/v1/bundles', body);
      return response.data;
    } catch (error) {
      // Try fallback regions
      return this.sendWithFallback(body);
    }
  }

  /**
   * Get the status of a submitted bundle
   */
  async getBundleStatus(bundleId: string): Promise<BundleStatusResult | null> {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getBundleStatuses',
      params: [[bundleId]],
    };

    try {
      const response = await this.httpClient.post('/api/v1/bundles', body);
      const statuses = response.data?.result?.value;

      if (!statuses || statuses.length === 0) {
        return null;
      }

      const status = statuses[0];
      return {
        bundleId: status.bundle_id || bundleId,
        status: mapBundleStatus(status.confirmation_status),
        landedSlot: status.slot,
        error: status.err ? JSON.stringify(status.err) : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the tip floor (minimum tip for bundle inclusion)
   */
  async getTipFloor(): Promise<Record<string, number>> {
    try {
      const response = await axios.get(
        'https://bundles.jito.wtf/api/v1/bundles/tip_floor',
        { timeout: 3000 }
      );
      return response.data?.[0] || {};
    } catch {
      return {
        landed_tips_25th_percentile: 1000,
        landed_tips_50th_percentile: 10000,
        landed_tips_75th_percentile: 100000,
        landed_tips_95th_percentile: 1000000,
      };
    }
  }

  /**
   * Try sending to fallback regions on failure
   */
  private async sendWithFallback(body: Record<string, unknown>): Promise<BundleSubmissionResult> {
    const regions = this.config.fallbackRegions.filter(r => r !== this.currentRegion);

    for (const region of regions) {
      try {
        const client = this.createHttpClient(region);
        const response = await client.post('/api/v1/bundles', body);
        // Switch to this region for future requests
        this.currentRegion = region;
        this.httpClient = client;
        return response.data;
      } catch {
        continue;
      }
    }

    throw new Error('All Jito regions failed. Bundle could not be submitted.');
  }

  private createHttpClient(region: JitoRegion): AxiosInstance {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    return axios.create({
      baseURL: JITO_ENDPOINTS[region],
      timeout: this.config.timeout,
      headers,
    });
  }
}

/** Map Jito API status strings to our enum */
function mapBundleStatus(status: string): BundleStatusResult['status'] {
  switch (status?.toLowerCase()) {
    case 'confirmed':
    case 'finalized':
    case 'landed':
      return 'Landed';
    case 'processed':
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    default:
      return 'Invalid';
  }
}

/** Official Jito tip accounts (randomly select one per bundle) */
export const JITO_TIP_ACCOUNTS: PublicKey[] = [
  new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyRJFZnMP5bD2'),
  new PublicKey('HFqU5x63VTqvQss8hp11i4bVV8bD44PvwucfZ2bU7gRe'),
  new PublicKey('Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY'),
  new PublicKey('ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49'),
  new PublicKey('DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh'),
  new PublicKey('ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt'),
  new PublicKey('DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL'),
  new PublicKey('3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT'),
];

/** Select a random tip account */
export function getRandomTipAccount(): PublicKey {
  const idx = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
  return JITO_TIP_ACCOUNTS[idx];
}
