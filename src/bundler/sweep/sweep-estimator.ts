import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { TipStrategy, calculateTip } from '../jito/jito-tip';
import { JitoClient } from '../jito/jito-client';

/** Estimated cost per SOL transfer transaction */
const BASE_TX_FEE = 5000; // 5000 lamports = 0.000005 SOL

/** Rent exemption minimum (~0.00203928 SOL for a token account) */
const RENT_EXEMPTION_MINIMUM = 2039280;

/** Sweep estimation configuration */
export interface SweepEstimateConfig {
  sourceWallets: Array<{ keypair: Keypair; label?: string }>;
  destination: PublicKey;
  mode: 'sol-only' | 'tokens-only' | 'all';
  keepRentExempt: boolean;
  keepMinBalance?: number;
  useJito: boolean;
  jitoTipStrategy?: TipStrategy;
}

/** Preview of what will happen to each wallet */
export interface WalletSweepPreview {
  address: string;
  label?: string;
  currentBalance: number;
  estimatedFee: number;
  rentReserved: number;
  netTransfer: number;
  willSkip: boolean;
  skipReason?: string;
  tokenAccounts: number;
}

/** Full sweep estimation result */
export interface SweepEstimate {
  walletsToProcess: number;
  walletsToSkip: number;
  estimatedSolGross: number;
  estimatedFees: number;
  estimatedRentRecovery: number;
  estimatedNetSol: number;
  estimatedTxCount: number;
  estimatedJitoTip: number;
  estimatedDurationMs: number;
  breakdown: WalletSweepPreview[];
}

/**
 * Estimate the outcome of a sweep operation before executing it.
 * Fetches real balances and calculates exact fees.
 */
export async function estimateSweep(
  connection: Connection,
  config: SweepEstimateConfig
): Promise<SweepEstimate> {
  const breakdown: WalletSweepPreview[] = [];
  let totalGross = 0;
  let totalFees = 0;
  let totalRentRecovery = 0;
  let totalTxCount = 0;
  let walletsToProcess = 0;
  let walletsToSkip = 0;

  // Calculate Jito tip if applicable
  let jitoTip = 0;
  if (config.useJito) {
    const jitoClient = new JitoClient();
    const tip = await calculateTip(jitoClient, config.jitoTipStrategy || 'p25');
    jitoTip = tip.lamports;
  }

  for (const wallet of config.sourceWallets) {
    const address = wallet.keypair.publicKey;
    const balance = await connection.getBalance(address);

    const fee = BASE_TX_FEE;
    const rentReserved = config.keepRentExempt ? RENT_EXEMPTION_MINIMUM : 0;
    const keepMin = config.keepMinBalance || 0;
    const reserved = Math.max(rentReserved, keepMin);

    let tokenAccountCount = 0;
    let rentFromTokenClose = 0;

    if (config.mode !== 'sol-only') {
      // Count token accounts for fee estimation
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        address,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );
      tokenAccountCount = tokenAccounts.value.length;
      // Each closed token account recovers ~0.002 SOL rent
      rentFromTokenClose = tokenAccountCount * RENT_EXEMPTION_MINIMUM;
    }

    const netTransfer = balance - fee - reserved;

    const preview: WalletSweepPreview = {
      address: address.toBase58(),
      label: wallet.label,
      currentBalance: balance,
      estimatedFee: fee,
      rentReserved: reserved,
      netTransfer: Math.max(0, netTransfer),
      willSkip: netTransfer <= 0,
      tokenAccounts: tokenAccountCount,
    };

    if (netTransfer <= 0) {
      preview.skipReason = 'Balance too low to cover fees';
      walletsToSkip++;
    } else {
      walletsToProcess++;
      totalGross += balance - reserved;
      totalFees += fee;
      totalRentRecovery += rentFromTokenClose;
      totalTxCount += 1 + (tokenAccountCount > 0 ? Math.ceil(tokenAccountCount / 3) : 0);
    }

    breakdown.push(preview);
  }

  // Estimate duration: ~400ms per transaction
  const estimatedDuration = totalTxCount * 400;

  return {
    walletsToProcess,
    walletsToSkip,
    estimatedSolGross: totalGross,
    estimatedFees: totalFees + jitoTip,
    estimatedRentRecovery: totalRentRecovery,
    estimatedNetSol: totalGross - totalFees - jitoTip + totalRentRecovery,
    estimatedTxCount: totalTxCount,
    estimatedJitoTip: jitoTip,
    estimatedDurationMs: estimatedDuration,
    breakdown,
  };
}

/**
 * Format a sweep estimate for display
 */
export function formatSweepEstimate(estimate: SweepEstimate): string {
  const lines: string[] = [
    `Wallets to process: ${estimate.walletsToProcess}`,
    `Wallets to skip: ${estimate.walletsToSkip}`,
    `Gross SOL: ${(estimate.estimatedSolGross / LAMPORTS_PER_SOL).toFixed(9)} SOL`,
    `Estimated fees: ${(estimate.estimatedFees / LAMPORTS_PER_SOL).toFixed(9)} SOL`,
    `Rent recovery: ${(estimate.estimatedRentRecovery / LAMPORTS_PER_SOL).toFixed(9)} SOL`,
    `Net SOL: ${(estimate.estimatedNetSol / LAMPORTS_PER_SOL).toFixed(9)} SOL`,
    `Transactions: ${estimate.estimatedTxCount}`,
    `Est. duration: ${(estimate.estimatedDurationMs / 1000).toFixed(1)}s`,
  ];

  if (estimate.estimatedJitoTip > 0) {
    lines.push(`Jito tip: ${(estimate.estimatedJitoTip / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
  }

  return lines.join('\n');
}
