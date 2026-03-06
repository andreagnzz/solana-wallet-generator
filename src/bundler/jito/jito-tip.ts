import { PublicKey } from '@solana/web3.js';
import { JitoClient, getRandomTipAccount } from './jito-client';

/** Tip strategy based on percentile of recent landed tips */
export type TipStrategy = 'min' | 'p25' | 'p50' | 'p75' | 'p95' | 'custom';

/** Result of tip calculation */
export interface TipResult {
  lamports: number;
  tipAccount: PublicKey;
  strategy: TipStrategy;
}

/** Cached tip floor data */
interface TipFloorCache {
  data: Record<string, number>;
  fetchedAt: number;
}

const TIP_FLOOR_CACHE_TTL_MS = 10_000; // Cache for 10 seconds
let tipFloorCache: TipFloorCache | null = null;

/** Minimum tip to even be considered */
const MIN_TIP_LAMPORTS = 1000; // 0.000001 SOL

/**
 * Calculate the optimal Jito tip based on strategy and current network conditions.
 *
 * @param client - JitoClient for fetching tip floor data
 * @param strategy - Tip strategy (percentile-based or custom)
 * @param customLamports - Custom tip amount (only used with 'custom' strategy)
 * @returns Tip amount in lamports and the randomly selected tip account
 */
export async function calculateTip(
  client: JitoClient,
  strategy: TipStrategy,
  customLamports?: number
): Promise<TipResult> {
  const tipAccount = getRandomTipAccount();

  if (strategy === 'custom') {
    if (!customLamports || customLamports <= 0) {
      throw new Error('Custom tip strategy requires a positive customLamports value');
    }
    return {
      lamports: customLamports,
      tipAccount,
      strategy,
    };
  }

  // Fetch tip floor data (with caching)
  const tipFloor = await getTipFloor(client);

  let lamports: number;

  switch (strategy) {
    case 'min':
      lamports = Math.max(
        tipFloor['landed_tips_25th_percentile'] || MIN_TIP_LAMPORTS,
        MIN_TIP_LAMPORTS
      );
      break;
    case 'p25':
      lamports = tipFloor['landed_tips_25th_percentile'] || 10000;
      break;
    case 'p50':
      lamports = tipFloor['landed_tips_50th_percentile'] || 50000;
      break;
    case 'p75':
      lamports = tipFloor['landed_tips_75th_percentile'] || 100000;
      break;
    case 'p95':
      lamports = tipFloor['landed_tips_95th_percentile'] || 1000000;
      break;
    default:
      lamports = tipFloor['landed_tips_50th_percentile'] || 50000;
  }

  return {
    lamports: Math.max(lamports, MIN_TIP_LAMPORTS),
    tipAccount,
    strategy,
  };
}

/**
 * Get tip floor data with caching to avoid excessive API calls
 */
async function getTipFloor(client: JitoClient): Promise<Record<string, number>> {
  const now = Date.now();

  if (tipFloorCache && (now - tipFloorCache.fetchedAt) < TIP_FLOOR_CACHE_TTL_MS) {
    return tipFloorCache.data;
  }

  const data = await client.getTipFloor();
  tipFloorCache = { data, fetchedAt: now };
  return data;
}

/**
 * Estimate the cost of a tip in SOL
 */
export function tipToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

/**
 * Format tip info for display
 */
export function formatTipInfo(tip: TipResult): string {
  const sol = tipToSol(tip.lamports);
  return `Tip: ${tip.lamports.toLocaleString()} lamports (${sol.toFixed(9)} SOL) | Strategy: ${tip.strategy} | Account: ${tip.tipAccount.toBase58().substring(0, 8)}...`;
}
