import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import {
  DistributeTarget,
  DistributeStrategy,
  DistributionAllocation,
  calculateDistribution,
  getTotalRequired,
} from './distribute-strategy';

/** Result of distribution validation */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checks: {
    sourceSolBalance: boolean;
    sourceTokenBalance: boolean;
    destinationCount: boolean;
    amountCalculation: boolean;
    ataCreationCost: number;
  };
  summary: {
    totalToSend: number;
    estimatedFees: number;
    estimatedAtaCosts: number;
    totalRequired: number;
    sourceBalance: number;
    surplus: number;
  };
}

const BASE_TX_FEE = 5000;
const ATA_CREATION_COST = 2039280; // Rent exemption for a token account
const MAX_DESTINATIONS = 10000;
const SOL_TRANSFERS_PER_TX = 20;
const SPL_TRANSFERS_PER_TX = 5;

/**
 * Validate a distribution configuration before execution.
 *
 * Checks:
 * - Source has enough SOL/tokens to cover the distribution + fees
 * - Destination count is within limits
 * - Amount calculations are valid
 * - ATA creation costs for SPL tokens
 */
export async function validateDistribution(
  connection: Connection,
  sourceKeypair: Keypair,
  destinations: DistributeTarget[],
  strategy: DistributeStrategy,
  token?: PublicKey,
  createAtaIfMissing: boolean = true
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check destination count
  const destinationCount = destinations.length <= MAX_DESTINATIONS;
  if (!destinationCount) {
    errors.push(`Too many destinations: ${destinations.length} (max ${MAX_DESTINATIONS})`);
  }

  // Calculate distribution amounts
  let allocations: DistributionAllocation[] = [];
  let amountCalculation = true;
  try {
    // For fill-to strategy, we need current balances
    let currentBalances: Map<string, number> | undefined;
    if (strategy.type === 'fill-to') {
      currentBalances = new Map();
      for (const dest of destinations) {
        const balance = await connection.getBalance(dest.address);
        currentBalances.set(dest.address.toBase58(), balance);
      }
    }

    allocations = calculateDistribution(destinations, strategy, currentBalances);
  } catch (err) {
    errors.push(`Strategy error: ${(err as Error).message}`);
    amountCalculation = false;
    allocations = [];
  }

  const totalToSend = getTotalRequired(allocations);

  // Estimate fees
  const transfersPerTx = token ? SPL_TRANSFERS_PER_TX : SOL_TRANSFERS_PER_TX;
  const txCount = Math.ceil(allocations.filter(a => a.amount > 0).length / transfersPerTx);
  const estimatedFees = txCount * BASE_TX_FEE;

  // Check ATA creation costs for SPL tokens
  let ataCreationCost = 0;
  if (token && createAtaIfMissing) {
    for (const alloc of allocations) {
      if (alloc.amount <= 0) continue;
      const ata = await getAssociatedTokenAddress(token, alloc.address);
      const info = await connection.getAccountInfo(ata);
      if (!info) {
        ataCreationCost += ATA_CREATION_COST;
      }
    }
  }

  // Check source SOL balance
  const sourceBalance = await connection.getBalance(sourceKeypair.publicKey);
  let sourceSolBalance: boolean;

  if (token) {
    // For SPL tokens, source needs SOL for fees + ATA creation
    const solNeeded = estimatedFees + ataCreationCost;
    sourceSolBalance = sourceBalance >= solNeeded;
    if (!sourceSolBalance) {
      errors.push(
        `Insufficient SOL for fees: need ${(solNeeded / LAMPORTS_PER_SOL).toFixed(9)} SOL, have ${(sourceBalance / LAMPORTS_PER_SOL).toFixed(9)} SOL`
      );
    }
  } else {
    // For native SOL, source needs enough for transfers + fees
    const totalNeeded = totalToSend + estimatedFees;
    sourceSolBalance = sourceBalance >= totalNeeded;
    if (!sourceSolBalance) {
      errors.push(
        `Insufficient SOL: need ${(totalNeeded / LAMPORTS_PER_SOL).toFixed(9)} SOL (${(totalToSend / LAMPORTS_PER_SOL).toFixed(9)} + ${(estimatedFees / LAMPORTS_PER_SOL).toFixed(9)} fees), have ${(sourceBalance / LAMPORTS_PER_SOL).toFixed(9)} SOL`
      );
    }
  }

  // Check source token balance for SPL
  let sourceTokenBalance = true;
  if (token) {
    try {
      const sourceAta = await getAssociatedTokenAddress(token, sourceKeypair.publicKey);
      const tokenAccountInfo = await connection.getParsedAccountInfo(sourceAta);

      if (!tokenAccountInfo.value) {
        errors.push('Source wallet has no token account for this mint');
        sourceTokenBalance = false;
      } else {
        const data = tokenAccountInfo.value.data;
        if ('parsed' in data) {
          const tokenBalance = BigInt(data.parsed.info.tokenAmount.amount as string);
          if (tokenBalance < BigInt(totalToSend)) {
            errors.push(`Insufficient token balance: need ${totalToSend}, have ${tokenBalance}`);
            sourceTokenBalance = false;
          }
        }
      }
    } catch {
      errors.push('Failed to check source token balance');
      sourceTokenBalance = false;
    }
  }

  // Warnings
  const skippedCount = allocations.filter(a => a.amount === 0).length;
  if (skippedCount > 0) {
    warnings.push(`${skippedCount} destinations will be skipped (amount = 0)`);
  }

  if (ataCreationCost > 0) {
    warnings.push(
      `${Math.round(ataCreationCost / ATA_CREATION_COST)} ATAs need to be created (cost: ${(ataCreationCost / LAMPORTS_PER_SOL).toFixed(9)} SOL)`
    );
  }

  const totalRequired = token
    ? estimatedFees + ataCreationCost
    : totalToSend + estimatedFees;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks: {
      sourceSolBalance,
      sourceTokenBalance,
      destinationCount,
      amountCalculation,
      ataCreationCost,
    },
    summary: {
      totalToSend,
      estimatedFees,
      estimatedAtaCosts: ataCreationCost,
      totalRequired,
      sourceBalance,
      surplus: sourceBalance - totalRequired,
    },
  };
}
