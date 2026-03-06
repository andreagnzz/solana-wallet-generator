import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  SendOptions,
} from '@solana/web3.js';

/** Result of transaction simulation */
export interface SimulationResult {
  success: boolean;
  logs: string[];
  unitsConsumed: number;
  error?: {
    type: string;
    message: string;
    instructionIndex?: number;
  };
  balanceChanges: Map<string, number>;
}

/**
 * Fluent builder for constructing optimized Versioned Transactions (v0).
 *
 * Usage:
 * ```ts
 * const sig = await new TxBuilder(connection, feePayer)
 *   .setComputeUnitPrice(50000)
 *   .setComputeUnitLimit(200000)
 *   .addInstruction(transferIx)
 *   .addMemo("my memo")
 *   .buildAndSend(signers, connection);
 * ```
 */
export class TxBuilder {
  private readonly connection: Connection;
  private readonly feePayer: PublicKey;
  private instructions: TransactionInstruction[] = [];
  private lookupTables: AddressLookupTableAccount[] = [];
  private computeUnitPrice: number | null = null;
  private computeUnitLimit: number | null = null;

  constructor(connection: Connection, feePayer: PublicKey) {
    this.connection = connection;
    this.feePayer = feePayer;
  }

  /** Add a single instruction */
  addInstruction(ix: TransactionInstruction): this {
    this.instructions.push(ix);
    return this;
  }

  /** Add multiple instructions */
  addInstructions(ixs: TransactionInstruction[]): this {
    this.instructions.push(...ixs);
    return this;
  }

  /** Set the compute unit price (priority fee) in micro-lamports */
  setComputeUnitPrice(microLamports: number): this {
    this.computeUnitPrice = microLamports;
    return this;
  }

  /** Set the compute unit limit */
  setComputeUnitLimit(units: number): this {
    this.computeUnitLimit = units;
    return this;
  }

  /** Add a memo instruction */
  addMemo(text: string): this {
    const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    this.instructions.push(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(text, 'utf8'),
      })
    );
    return this;
  }

  /** Add address lookup tables for compact transaction size */
  addLookupTables(tables: AddressLookupTableAccount[]): this {
    this.lookupTables.push(...tables);
    return this;
  }

  /** Simulate the transaction without sending */
  async simulate(): Promise<SimulationResult> {
    const tx = await this.buildUnsigned();

    const sim = await this.connection.simulateTransaction(tx, {
      sigVerify: false,
    });

    const balanceChanges = new Map<string, number>();

    if (sim.value.err) {
      const errStr = JSON.stringify(sim.value.err);
      return {
        success: false,
        logs: sim.value.logs || [],
        unitsConsumed: sim.value.unitsConsumed || 0,
        error: {
          type: typeof sim.value.err === 'object' ? Object.keys(sim.value.err)[0] : 'unknown',
          message: errStr,
        },
        balanceChanges,
      };
    }

    return {
      success: true,
      logs: sim.value.logs || [],
      unitsConsumed: sim.value.unitsConsumed || 0,
      balanceChanges,
    };
  }

  /** Build the transaction (unsigned) */
  async buildUnsigned(): Promise<VersionedTransaction> {
    const allInstructions = this.buildInstructionList();
    const { blockhash } = await this.connection.getLatestBlockhash();

    const message = new TransactionMessage({
      payerKey: this.feePayer,
      recentBlockhash: blockhash,
      instructions: allInstructions,
    }).compileToV0Message(this.lookupTables.length > 0 ? this.lookupTables : undefined);

    return new VersionedTransaction(message);
  }

  /** Build and sign the transaction */
  async build(signers: Keypair[]): Promise<VersionedTransaction> {
    const tx = await this.buildUnsigned();
    tx.sign(signers);
    return tx;
  }

  /** Build, sign, send, and confirm the transaction */
  async buildAndSend(
    signers: Keypair[],
    connection?: Connection,
    options?: SendOptions
  ): Promise<string> {
    const conn = connection || this.connection;
    const tx = await this.build(signers);

    const signature = await conn.sendTransaction(tx, {
      skipPreflight: false,
      ...options,
    });

    const latestBlockhash = await conn.getLatestBlockhash();
    await conn.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    }, 'confirmed');

    return signature;
  }

  /** Assemble the full instruction list with ComputeBudget prepended */
  private buildInstructionList(): TransactionInstruction[] {
    const result: TransactionInstruction[] = [];

    if (this.computeUnitPrice !== null) {
      result.push(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: this.computeUnitPrice })
      );
    }

    if (this.computeUnitLimit !== null) {
      result.push(
        ComputeBudgetProgram.setComputeUnitLimit({ units: this.computeUnitLimit })
      );
    }

    result.push(...this.instructions);
    return result;
  }
}
