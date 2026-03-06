import {
  Connection,
  Transaction,
  VersionedTransaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import axios from 'axios';

/** Priority fee calculation strategy */
export interface PriorityFeeConfig {
  strategy: 'auto' | 'fixed' | 'percentile';
  fixedMicroLamports?: number;
  percentile?: 25 | 50 | 75 | 90 | 95 | 99;
  maxMicroLamports?: number;
  computeUnits?: number;
}

/** Result of priority fee calculation */
export interface PriorityFeeResult {
  microLamports: number;
  computeUnits: number;
  estimatedFeeLamports: number;
}

const DEFAULT_COMPUTE_UNITS = 200_000;
const DEFAULT_MAX_MICRO_LAMPORTS = 10_000_000; // 10 SOL per 1M CU cap
const FALLBACK_MICRO_LAMPORTS = 100_000;

/**
 * Get the optimal priority fee for a transaction.
 *
 * Sources (in order of preference):
 * 1. Helius getPriorityFeeEstimate API
 * 2. RPC getRecentPrioritizationFees
 * 3. Fallback fixed value
 */
export async function getOptimalPriorityFee(
  connection: Connection,
  _transaction: VersionedTransaction | Transaction,
  config: PriorityFeeConfig
): Promise<PriorityFeeResult> {
  const computeUnits = config.computeUnits || DEFAULT_COMPUTE_UNITS;
  const maxFee = config.maxMicroLamports || DEFAULT_MAX_MICRO_LAMPORTS;

  let microLamports: number;

  if (config.strategy === 'fixed') {
    microLamports = config.fixedMicroLamports || FALLBACK_MICRO_LAMPORTS;
  } else if (config.strategy === 'percentile' || config.strategy === 'auto') {
    microLamports = await fetchPriorityFeeFromRpc(connection, config.percentile || 75);
  } else {
    microLamports = FALLBACK_MICRO_LAMPORTS;
  }

  // Apply cap
  microLamports = Math.min(microLamports, maxFee);

  const estimatedFeeLamports = Math.ceil((microLamports * computeUnits) / 1_000_000);

  return { microLamports, computeUnits, estimatedFeeLamports };
}

/**
 * Fetch priority fee from Helius API (if available)
 */
export async function fetchPriorityFeeFromHelius(
  heliusUrl: string,
  serializedTx?: string
): Promise<number> {
  try {
    const body: Record<string, unknown> = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getPriorityFeeEstimate',
      params: [{}],
    };

    if (serializedTx) {
      (body.params as Record<string, unknown>[])[0] = { transaction: serializedTx };
    }

    const response = await axios.post(heliusUrl, body, { timeout: 3000 });
    const result = response.data?.result;

    if (result?.priorityFeeEstimate) {
      return Math.ceil(result.priorityFeeEstimate);
    }
    return FALLBACK_MICRO_LAMPORTS;
  } catch {
    return FALLBACK_MICRO_LAMPORTS;
  }
}

/**
 * Fetch priority fee from standard RPC getRecentPrioritizationFees
 */
async function fetchPriorityFeeFromRpc(
  connection: Connection,
  percentile: number
): Promise<number> {
  try {
    const fees = await connection.getRecentPrioritizationFees();

    if (fees.length === 0) return FALLBACK_MICRO_LAMPORTS;

    const sorted = fees
      .map(f => f.prioritizationFee)
      .filter(f => f > 0)
      .sort((a, b) => a - b);

    if (sorted.length === 0) return FALLBACK_MICRO_LAMPORTS;

    const index = Math.min(
      Math.floor((percentile / 100) * sorted.length),
      sorted.length - 1
    );
    return sorted[index];
  } catch {
    return FALLBACK_MICRO_LAMPORTS;
  }
}

/**
 * Create ComputeBudget instructions to prepend to a transaction
 */
export function addPriorityFeeInstructions(
  instructions: TransactionInstruction[],
  priorityFee: number,
  computeUnits: number
): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    ...instructions,
  ];
}
