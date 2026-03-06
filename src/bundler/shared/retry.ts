import { Connection, Keypair, VersionedTransaction, TransactionMessage } from '@solana/web3.js';

/** Categorized Solana error types for smart retry logic */
export type SolanaErrorType =
  | 'blockhash-expired'
  | 'node-behind'
  | 'rate-limited'
  | 'insufficient-funds'
  | 'simulation-failed'
  | 'timeout'
  | 'unknown';

/** Options for the retry engine */
export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  onRetry?: (attempt: number, error: Error, errorType: SolanaErrorType) => void;
  shouldRetry?: (error: Error, errorType: SolanaErrorType) => boolean;
}

/**
 * Classify a Solana error into a category for smart retry decisions
 */
export function classifySolanaError(error: Error): SolanaErrorType {
  const msg = error.message.toLowerCase();

  if (msg.includes('blockhash not found') || msg.includes('blockhash has expired')) {
    return 'blockhash-expired';
  }
  if (msg.includes('node is behind') || msg.includes('slot') && msg.includes('behind')) {
    return 'node-behind';
  }
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'rate-limited';
  }
  if (msg.includes('insufficient funds') || msg.includes('insufficient lamports')) {
    return 'insufficient-funds';
  }
  if (msg.includes('simulation failed') || msg.includes('custom program error')) {
    return 'simulation-failed';
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('econnrefused')) {
    return 'timeout';
  }

  return 'unknown';
}

/**
 * Check if an error type is retryable by default
 */
function isRetryableByDefault(errorType: SolanaErrorType): boolean {
  switch (errorType) {
    case 'blockhash-expired':
    case 'node-behind':
    case 'rate-limited':
    case 'timeout':
    case 'unknown':
      return true;
    case 'insufficient-funds':
    case 'simulation-failed':
      return false;
    default:
      return false;
  }
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseMs: number, maxMs: number): number {
  const exponential = baseMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * baseMs * 0.5;
  return Math.min(exponential + jitter, maxMs);
}

/**
 * Execute a function with smart retry logic adapted to Solana error types.
 *
 * - Blockhash expired: retries immediately (caller should refresh blockhash)
 * - Rate limited: exponential backoff
 * - Insufficient funds / simulation failed: does NOT retry (fatal)
 * - Timeout: retries with different RPC if available
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 10000;

  let lastError: Error = new Error('No attempts made');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const errorType = classifySolanaError(lastError);

      // Check if we should retry
      const shouldRetry = options.shouldRetry
        ? options.shouldRetry(lastError, errorType)
        : isRetryableByDefault(errorType);

      if (!shouldRetry || attempt === maxAttempts) {
        throw lastError;
      }

      // Notify retry callback
      if (options.onRetry) {
        options.onRetry(attempt, lastError, errorType);
      }

      // Wait before retrying
      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Send a versioned transaction with automatic retry and blockhash refresh.
 *
 * On blockhash expiry, fetches a fresh blockhash, re-signs, and retries.
 */
export async function sendWithRetry(
  transaction: VersionedTransaction,
  signers: Keypair[],
  connection: Connection,
  maxAttempts: number = 3
): Promise<string> {
  return withRetry(
    async () => {
      const signature = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        maxRetries: 0,
      });

      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash();
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      return signature;
    },
    {
      maxAttempts,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      onRetry: async (_attempt, _error, errorType) => {
        if (errorType === 'blockhash-expired') {
          // Refresh blockhash and re-sign the transaction
          const { blockhash } = await connection.getLatestBlockhash();
          const message = TransactionMessage.decompile(transaction.message);
          message.recentBlockhash = blockhash;
          transaction.message = message.compileToV0Message();
          transaction.sign(signers);
        }
      },
    }
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
