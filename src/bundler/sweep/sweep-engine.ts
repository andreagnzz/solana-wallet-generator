import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createCloseAccountInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { TxBuilder } from '../shared/tx-builder';
import { withRetry } from '../shared/retry';
import { TipStrategy } from '../jito/jito-tip';
import { estimateSweep } from './sweep-estimator';

/** Rent exemption minimum */
const RENT_EXEMPTION = 2039280;
const BASE_TX_FEE = 5000;

/** Sweep configuration */
export interface SweepConfig {
  sourceWallets: Array<{ keypair: Keypair; label?: string }>;
  destination: PublicKey;
  mode: 'sol-only' | 'tokens-only' | 'all';
  keepRentExempt: boolean;
  keepMinBalance?: number;
  useJito: boolean;
  jitoTipStrategy?: TipStrategy;
  maxConcurrent: number;
  simulateFirst: boolean;
  dryRun: boolean;
}

/** Result of a sweep operation */
export interface SweepResult {
  walletsSwept: number;
  walletsSkipped: number;
  walletsErrored: number;
  totalSolCollected: number;
  totalTokensCollected: Map<string, number>;
  transactions: SweepTxResult[];
  totalFeePaid: number;
  netSolCollected: number;
  executionTimeMs: number;
}

/** Per-wallet sweep transaction result */
export interface SweepTxResult {
  wallet: string;
  label?: string;
  signature?: string;
  status: 'success' | 'skipped' | 'error';
  solAmount: number;
  error?: string;
}

/**
 * Execute a sweep: drain SOL and/or tokens from multiple wallets to a destination.
 */
export async function executeSweep(
  connection: Connection,
  config: SweepConfig
): Promise<SweepResult> {
  const startTime = Date.now();

  // Dry run: estimate only
  if (config.dryRun) {
    const estimate = await estimateSweep(connection, {
      sourceWallets: config.sourceWallets,
      destination: config.destination,
      mode: config.mode,
      keepRentExempt: config.keepRentExempt,
      keepMinBalance: config.keepMinBalance,
      useJito: config.useJito,
      jitoTipStrategy: config.jitoTipStrategy,
    });

    return {
      walletsSwept: 0,
      walletsSkipped: estimate.walletsToSkip,
      walletsErrored: 0,
      totalSolCollected: 0,
      totalTokensCollected: new Map(),
      transactions: estimate.breakdown.map(b => ({
        wallet: b.address,
        label: b.label,
        status: b.willSkip ? 'skipped' as const : 'success' as const,
        solAmount: b.netTransfer,
        error: b.skipReason,
      })),
      totalFeePaid: 0,
      netSolCollected: 0,
      executionTimeMs: Date.now() - startTime,
    };
  }

  const results: SweepTxResult[] = [];
  let totalSolCollected = 0;
  let totalFeePaid = 0;
  const totalTokensCollected = new Map<string, number>();
  let walletsSwept = 0;
  let walletsSkipped = 0;
  let walletsErrored = 0;

  // Process wallets with concurrency limit
  const batches = chunkArray(config.sourceWallets, config.maxConcurrent);

  for (const batch of batches) {
    const batchPromises = batch.map(async (wallet) => {
      const address = wallet.keypair.publicKey;

      try {
        // Get balance
        const balance = await connection.getBalance(address);
        const reserved = config.keepRentExempt
          ? Math.max(RENT_EXEMPTION, config.keepMinBalance || 0)
          : (config.keepMinBalance || 0);

        const netAmount = balance - BASE_TX_FEE - reserved;

        if (netAmount <= 0) {
          walletsSkipped++;
          results.push({
            wallet: address.toBase58(),
            label: wallet.label,
            status: 'skipped',
            solAmount: 0,
            error: 'Balance too low',
          });
          return;
        }

        // Sweep SOL
        if (config.mode === 'sol-only' || config.mode === 'all') {
          const signature = await sweepSol(
            connection,
            wallet.keypair,
            config.destination,
            netAmount,
            config.simulateFirst
          );

          totalSolCollected += netAmount;
          totalFeePaid += BASE_TX_FEE;
          walletsSwept++;

          results.push({
            wallet: address.toBase58(),
            label: wallet.label,
            signature,
            status: 'success',
            solAmount: netAmount,
          });
        }

        // Sweep tokens
        if (config.mode === 'tokens-only' || config.mode === 'all') {
          const tokenResult = await sweepTokens(
            connection,
            wallet.keypair,
            config.destination,
            config.simulateFirst
          );

          for (const [mint, amount] of tokenResult.tokensCollected) {
            const current = totalTokensCollected.get(mint) || 0;
            totalTokensCollected.set(mint, current + amount);
          }

          totalSolCollected += tokenResult.rentRecovered;
          totalFeePaid += tokenResult.feesPaid;
        }
      } catch (err) {
        walletsErrored++;
        results.push({
          wallet: address.toBase58(),
          label: wallet.label,
          status: 'error',
          solAmount: 0,
          error: (err as Error).message,
        });
      }
    });

    await Promise.all(batchPromises);
  }

  return {
    walletsSwept,
    walletsSkipped,
    walletsErrored,
    totalSolCollected,
    totalTokensCollected,
    transactions: results,
    totalFeePaid,
    netSolCollected: totalSolCollected - totalFeePaid,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Sweep SOL from a single wallet
 */
async function sweepSol(
  connection: Connection,
  source: Keypair,
  destination: PublicKey,
  amount: number,
  simulate: boolean
): Promise<string> {
  return withRetry(async () => {
    const builder = new TxBuilder(connection, source.publicKey)
      .addInstruction(
        SystemProgram.transfer({
          fromPubkey: source.publicKey,
          toPubkey: destination,
          lamports: amount,
        })
      );

    if (simulate) {
      const sim = await builder.simulate();
      if (!sim.success) {
        throw new Error(`Simulation failed: ${sim.error?.message}`);
      }
    }

    return builder.buildAndSend([source]);
  }, { maxAttempts: 3 });
}

/**
 * Sweep all SPL tokens from a wallet and close empty accounts
 */
async function sweepTokens(
  connection: Connection,
  source: Keypair,
  destination: PublicKey,
  simulate: boolean
): Promise<{ tokensCollected: Map<string, number>; rentRecovered: number; feesPaid: number }> {
  const tokensCollected = new Map<string, number>();
  let rentRecovered = 0;
  let feesPaid = 0;

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    source.publicKey,
    { programId: TOKEN_PROGRAM_ID }
  );

  for (const ta of tokenAccounts.value) {
    const info = ta.account.data.parsed.info;
    const mint = new PublicKey(info.mint as string);
    const amount = info.tokenAmount.amount as string;
    const uiAmount = info.tokenAmount.uiAmount as number;

    if (BigInt(amount) === 0n) {
      // Just close the empty account to recover rent
      const builder = new TxBuilder(connection, source.publicKey)
        .addInstruction(
          createCloseAccountInstruction(
            ta.pubkey,
            source.publicKey, // rent goes to source first
            source.publicKey
          )
        );

      if (simulate) {
        const sim = await builder.simulate();
        if (!sim.success) continue;
      }

      await builder.buildAndSend([source]);
      rentRecovered += RENT_EXEMPTION;
      feesPaid += BASE_TX_FEE;
      continue;
    }

    // Transfer token + close account
    const destAta = await getAssociatedTokenAddress(mint, destination);

    const builder = new TxBuilder(connection, source.publicKey);

    // Create destination ATA if needed
    const destAtaInfo = await connection.getAccountInfo(destAta);
    if (!destAtaInfo) {
      builder.addInstruction(
        createAssociatedTokenAccountInstruction(
          source.publicKey,
          destAta,
          destination,
          mint
        )
      );
    }

    // Transfer all tokens
    builder.addInstruction(
      createTransferInstruction(
        ta.pubkey,
        destAta,
        source.publicKey,
        BigInt(amount)
      )
    );

    // Close source token account to recover rent
    builder.addInstruction(
      createCloseAccountInstruction(
        ta.pubkey,
        source.publicKey,
        source.publicKey
      )
    );

    if (simulate) {
      const sim = await builder.simulate();
      if (!sim.success) continue;
    }

    await builder.buildAndSend([source]);
    tokensCollected.set(mint.toBase58(), uiAmount);
    rentRecovered += RENT_EXEMPTION;
    feesPaid += BASE_TX_FEE;
  }

  return { tokensCollected, rentRecovered, feesPaid };
}

/** Chunk an array into batches */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
