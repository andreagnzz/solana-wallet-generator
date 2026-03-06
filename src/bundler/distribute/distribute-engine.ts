import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import {
  DistributeTarget,
  DistributeStrategy,
  DistributionAllocation,
  calculateDistribution,
} from './distribute-strategy';
import { validateDistribution } from './distribute-validator';
import { TxBuilder } from '../shared/tx-builder';
import { withRetry } from '../shared/retry';
import { TipStrategy } from '../jito/jito-tip';

/** Distribution configuration */
export interface DistributeConfig {
  sourceKeypair: Keypair;
  destinations: DistributeTarget[];
  token?: PublicKey;
  strategy: DistributeStrategy;
  useJito: boolean;
  jitoTipStrategy?: TipStrategy;
  createAtaIfMissing: boolean;
  maxConcurrent: number;
  simulateFirst: boolean;
  dryRun: boolean;
  memo?: string;
}

/** Distribution result */
export interface DistributeResult {
  totalDistributed: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  transactions: DistributeTxResult[];
  feePaid: number;
  executionTimeMs: number;
}

/** Per-batch transaction result */
export interface DistributeTxResult {
  signature?: string;
  status: 'success' | 'error' | 'skipped';
  recipients: string[];
  totalAmount: number;
  error?: string;
}

/** Max transfers per transaction */
const SOL_BATCH_SIZE = 20;
const SPL_BATCH_SIZE = 5;

/**
 * Execute a distribution of SOL or SPL tokens to multiple destinations.
 *
 * Batches transfers into as few transactions as possible:
 * - SOL: up to 20 transfers per transaction
 * - SPL: up to 5 transfers per transaction (heavier on compute)
 */
export async function executeDistribute(
  connection: Connection,
  config: DistributeConfig
): Promise<DistributeResult> {
  const startTime = Date.now();

  // Validate first
  const validation = await validateDistribution(
    connection,
    config.sourceKeypair,
    config.destinations,
    config.strategy,
    config.token,
    config.createAtaIfMissing
  );

  if (!validation.valid) {
    throw new Error(`Validation failed:\n${validation.errors.join('\n')}`);
  }

  // Calculate allocations
  let currentBalances: Map<string, number> | undefined;
  if (config.strategy.type === 'fill-to') {
    currentBalances = new Map();
    for (const dest of config.destinations) {
      const balance = await connection.getBalance(dest.address);
      currentBalances.set(dest.address.toBase58(), balance);
    }
  }

  const allocations = calculateDistribution(
    config.destinations,
    config.strategy,
    currentBalances
  );

  // Filter out zero allocations
  const activeAllocations = allocations.filter(a => a.amount > 0);
  const skippedCount = allocations.length - activeAllocations.length;

  if (config.dryRun) {
    return {
      totalDistributed: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount,
      transactions: activeAllocations.map(a => ({
        status: 'skipped' as const,
        recipients: [a.address.toBase58()],
        totalAmount: a.amount,
      })),
      feePaid: 0,
      executionTimeMs: Date.now() - startTime,
    };
  }

  // Batch allocations
  const batchSize = config.token ? SPL_BATCH_SIZE : SOL_BATCH_SIZE;
  const batches = chunkArray(activeAllocations, batchSize);

  const results: DistributeTxResult[] = [];
  let totalDistributed = 0;
  let successCount = 0;
  let failureCount = 0;
  let feePaid = 0;

  for (const batch of batches) {
    try {
      const signature = await sendBatch(
        connection,
        config.sourceKeypair,
        batch,
        config.token,
        config.createAtaIfMissing,
        config.simulateFirst,
        config.memo
      );

      const batchTotal = batch.reduce((sum, a) => sum + a.amount, 0);
      totalDistributed += batchTotal;
      successCount += batch.length;
      feePaid += 5000; // base fee per tx

      results.push({
        signature,
        status: 'success',
        recipients: batch.map(a => a.address.toBase58()),
        totalAmount: batchTotal,
      });
    } catch (err) {
      failureCount += batch.length;
      results.push({
        status: 'error',
        recipients: batch.map(a => a.address.toBase58()),
        totalAmount: batch.reduce((sum, a) => sum + a.amount, 0),
        error: (err as Error).message,
      });
    }
  }

  return {
    totalDistributed,
    successCount,
    failureCount,
    skippedCount,
    transactions: results,
    feePaid,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Send a batch of transfers in a single transaction
 */
async function sendBatch(
  connection: Connection,
  source: Keypair,
  allocations: DistributionAllocation[],
  token: PublicKey | undefined,
  createAta: boolean,
  simulate: boolean,
  memo?: string
): Promise<string> {
  return withRetry(async () => {
    const builder = new TxBuilder(connection, source.publicKey);

    if (token) {
      // SPL token transfers
      for (const alloc of allocations) {
        const sourceAta = await getAssociatedTokenAddress(token, source.publicKey);
        const destAta = await getAssociatedTokenAddress(token, alloc.address);

        // Create ATA if missing
        if (createAta) {
          const destAtaInfo = await connection.getAccountInfo(destAta);
          if (!destAtaInfo) {
            builder.addInstruction(
              createAssociatedTokenAccountInstruction(
                source.publicKey,
                destAta,
                alloc.address,
                token
              )
            );
          }
        }

        builder.addInstruction(
          createTransferInstruction(
            sourceAta,
            destAta,
            source.publicKey,
            BigInt(alloc.amount)
          )
        );
      }
    } else {
      // Native SOL transfers
      for (const alloc of allocations) {
        builder.addInstruction(
          SystemProgram.transfer({
            fromPubkey: source.publicKey,
            toPubkey: alloc.address,
            lamports: alloc.amount,
          })
        );
      }
    }

    if (memo) {
      builder.addMemo(memo);
    }

    if (simulate) {
      const sim = await builder.simulate();
      if (!sim.success) {
        throw new Error(`Simulation failed: ${sim.error?.message}`);
      }
    }

    return builder.buildAndSend([source]);
  }, { maxAttempts: 3 });
}

/** Chunk array into batches */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
