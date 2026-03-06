import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { JitoClient, BundleSubmissionResult } from './jito-client';
import { TipStrategy, calculateTip, TipResult } from './jito-tip';
import { simulateBundle } from '../shared/simulation';

/** Maximum transactions per Jito bundle */
const MAX_BUNDLE_TXS = 5;

/** Maximum compute units per bundle */
const MAX_BUNDLE_CU = 1_200_000;

/** Jito bundle configuration */
export interface JitoBundleConfig {
  tipStrategy: TipStrategy;
  customTipLamports?: number;
  tipPayer: Keypair;
  connection: Connection;
  simulateFirst: boolean;
  computeUnitPrice?: number;
}

/** Constructed Jito bundle */
export interface JitoBundle {
  transactions: VersionedTransaction[];
  tipLamports: number;
  tipAccount: PublicKey;
  metadata?: {
    label?: string;
    expectedProfit?: number;
    maxSlippage?: number;
  };
}

/** Bundle send result */
export interface BundleSendResult {
  bundleId: string;
  status: 'pending' | 'landed' | 'failed';
  slot?: number;
  error?: string;
}

/**
 * Build a Jito bundle from arrays of instructions.
 *
 * The first transaction is automatically the tip payment.
 * Each subsequent array of instructions becomes its own transaction.
 * All transactions share the same recentBlockhash for atomicity.
 *
 * @param instructions - Array of instruction arrays (one per transaction, max 4)
 * @param signers - Array of signer arrays (one per transaction)
 * @param config - Bundle configuration
 * @returns Constructed JitoBundle
 */
export async function buildJitoBundle(
  instructions: TransactionInstruction[][],
  signers: Keypair[][],
  config: JitoBundleConfig
): Promise<JitoBundle> {
  if (instructions.length === 0) {
    throw new Error('Bundle must contain at least one transaction');
  }

  if (instructions.length > MAX_BUNDLE_TXS - 1) {
    throw new Error(`Bundle can contain at most ${MAX_BUNDLE_TXS - 1} user transactions (tip tx is added automatically)`);
  }

  if (instructions.length !== signers.length) {
    throw new Error('Instructions and signers arrays must have the same length');
  }

  // Calculate tip
  const jitoClient = new JitoClient();
  const tip: TipResult = await calculateTip(
    jitoClient,
    config.tipStrategy,
    config.customTipLamports
  );

  // Get a single blockhash for all transactions (atomicity requirement)
  const { blockhash } = await config.connection.getLatestBlockhash('confirmed');

  // Build tip transaction (always first)
  const tipIx = SystemProgram.transfer({
    fromPubkey: config.tipPayer.publicKey,
    toPubkey: tip.tipAccount,
    lamports: tip.lamports,
  });

  const tipMessage = new TransactionMessage({
    payerKey: config.tipPayer.publicKey,
    recentBlockhash: blockhash,
    instructions: [tipIx],
  }).compileToV0Message();

  const tipTx = new VersionedTransaction(tipMessage);
  tipTx.sign([config.tipPayer]);

  // Build user transactions
  const userTxs: VersionedTransaction[] = [];

  for (let i = 0; i < instructions.length; i++) {
    const ixs = instructions[i];
    const txSigners = signers[i];
    const feePayer = txSigners[0];

    const message = new TransactionMessage({
      payerKey: feePayer.publicKey,
      recentBlockhash: blockhash,
      instructions: ixs,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign(txSigners);
    userTxs.push(tx);
  }

  const allTxs = [tipTx, ...userTxs];

  // Simulate if requested
  if (config.simulateFirst) {
    const simResults = await simulateBundle(config.connection, allTxs);
    const failed = simResults.find(r => !r.success);
    if (failed) {
      throw new Error(
        `Bundle simulation failed: ${failed.error?.message || 'Unknown error'}`
      );
    }

    // Check total compute units
    const totalCU = simResults.reduce((sum, r) => sum + r.unitsConsumed, 0);
    if (totalCU > MAX_BUNDLE_CU) {
      throw new Error(
        `Bundle exceeds max compute units: ${totalCU} > ${MAX_BUNDLE_CU}`
      );
    }
  }

  return {
    transactions: allTxs,
    tipLamports: tip.lamports,
    tipAccount: tip.tipAccount,
  };
}

/**
 * Send a constructed bundle to the Jito Block Engine
 */
export async function sendBundle(
  bundle: JitoBundle,
  client: JitoClient
): Promise<BundleSendResult> {
  // Serialize all transactions to base58
  const serialized = bundle.transactions.map(tx =>
    bs58.encode(Buffer.from(tx.serialize()))
  );

  const response: BundleSubmissionResult = await client.sendBundle(serialized);

  if (response.error) {
    return {
      bundleId: '',
      status: 'failed',
      error: response.error.message,
    };
  }

  return {
    bundleId: response.result || '',
    status: 'pending',
  };
}

/**
 * Build a simple 2-tx bundle: tip + one user transaction
 */
export async function buildSimpleBundle(
  instructions: TransactionInstruction[],
  signers: Keypair[],
  config: JitoBundleConfig
): Promise<JitoBundle> {
  return buildJitoBundle([instructions], [signers], config);
}
