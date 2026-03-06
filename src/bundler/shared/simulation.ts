import { Connection, VersionedTransaction } from '@solana/web3.js';

/** Detailed simulation result */
export interface DetailedSimulation {
  success: boolean;
  signature: string | null;
  logs: string[];
  unitsConsumed: number;
  error?: SimulationError;
  accountChanges: AccountChange[];
}

/** Simulation error details */
export interface SimulationError {
  type: string;
  message: string;
  instructionIndex?: number;
  programId?: string;
}

/** Account balance change from simulation */
export interface AccountChange {
  address: string;
  preBalance: number;
  postBalance: number;
  delta: number;
}

/**
 * Simulate a versioned transaction with detailed error analysis
 */
export async function simulateTransaction(
  connection: Connection,
  transaction: VersionedTransaction
): Promise<DetailedSimulation> {
  const sim = await connection.simulateTransaction(transaction, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });

  const result: DetailedSimulation = {
    success: !sim.value.err,
    signature: null,
    logs: sim.value.logs || [],
    unitsConsumed: sim.value.unitsConsumed || 0,
    accountChanges: [],
  };

  if (sim.value.err) {
    result.error = parseSimulationError(sim.value.err, sim.value.logs || []);
  }

  return result;
}

/**
 * Simulate multiple transactions in sequence (for bundle validation)
 */
export async function simulateBundle(
  connection: Connection,
  transactions: VersionedTransaction[]
): Promise<DetailedSimulation[]> {
  const results: DetailedSimulation[] = [];

  for (const tx of transactions) {
    const result = await simulateTransaction(connection, tx);
    results.push(result);

    // If any transaction fails, the bundle would fail
    if (!result.success) {
      break;
    }
  }

  return results;
}

/**
 * Check if a simulation result indicates the transaction is safe to send
 */
export function isSimulationSafe(result: DetailedSimulation): boolean {
  if (!result.success) return false;

  // Check for suspicious logs
  const suspiciousPatterns = [
    'Program log: Error',
    'failed to complete',
    'exceeded CUs meter',
  ];

  for (const log of result.logs) {
    for (const pattern of suspiciousPatterns) {
      if (log.includes(pattern)) return false;
    }
  }

  return true;
}

/**
 * Parse simulation error into a structured format
 */
function parseSimulationError(
  err: unknown,
  logs: string[]
): SimulationError {
  if (typeof err === 'string') {
    return { type: 'string', message: err };
  }

  if (typeof err === 'object' && err !== null) {
    const errObj = err as Record<string, unknown>;

    // InstructionError format: { InstructionError: [index, { Custom: code }] }
    if ('InstructionError' in errObj) {
      const ie = errObj['InstructionError'] as [number, unknown];
      const index = ie[0];
      const innerErr = ie[1];

      // Find the program that failed from logs
      let programId: string | undefined;
      for (const log of logs) {
        if (log.includes('failed:') || log.includes('error')) {
          const match = log.match(/Program (\w+)/);
          if (match) programId = match[1];
        }
      }

      return {
        type: 'InstructionError',
        message: JSON.stringify(innerErr),
        instructionIndex: index,
        programId,
      };
    }

    return { type: 'object', message: JSON.stringify(err) };
  }

  return { type: 'unknown', message: String(err) };
}
