import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { validateMnemonic, getMnemonicWordCount, isValidWordCount } from '../crypto/entropy';
import { isValidDerivationPath } from '../crypto/derivation';
import { MnemonicLanguage, SolanaNetwork, WordCount } from '../types';

/**
 * Validate a Solana public address (base58 encoded)
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    const pubkey = new PublicKey(address);
    return PublicKey.isOnCurve(pubkey.toBytes());
  } catch {
    // PublicKey constructor will throw for invalid addresses, but not all
    // valid addresses are on the curve (e.g., PDAs). Try basic validation.
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Validate a Solana private key (base58 encoded, 64 bytes)
 */
export function isValidPrivateKey(key: string): boolean {
  try {
    const decoded = bs58.decode(key);
    return decoded.length === 64;
  } catch {
    return false;
  }
}

/**
 * Validate a BIP39 mnemonic phrase and return details
 */
export function validateMnemonicInput(
  mnemonic: string,
  language: MnemonicLanguage = 'english'
): { valid: boolean; wordCount: number; error?: string } {
  const trimmed = mnemonic.trim();

  if (!trimmed) {
    return { valid: false, wordCount: 0, error: 'Mnemonic cannot be empty' };
  }

  const wordCount = getMnemonicWordCount(trimmed);

  if (!isValidWordCount(wordCount)) {
    return {
      valid: false,
      wordCount,
      error: `Invalid word count: ${wordCount}. Must be 12, 15, 18, 21, or 24.`,
    };
  }

  if (!validateMnemonic(trimmed, language)) {
    return {
      valid: false,
      wordCount,
      error: 'Invalid mnemonic: checksum verification failed or invalid words.',
    };
  }

  return { valid: true, wordCount };
}

/**
 * Validate derivation path format
 */
export function validateDerivationPath(path: string): { valid: boolean; error?: string } {
  if (!path.startsWith('m/')) {
    return { valid: false, error: "Derivation path must start with 'm/'" };
  }

  if (!isValidDerivationPath(path)) {
    return {
      valid: false,
      error: "Invalid derivation path format. Expected format: m/44'/501'/{index}'/0'",
    };
  }

  return { valid: true };
}

/**
 * Validate network name
 */
export function validateNetwork(network: string): network is SolanaNetwork {
  return ['mainnet', 'devnet', 'testnet', 'custom'].includes(network);
}

/**
 * Validate word count for mnemonic generation
 */
export function validateWordCount(count: number): count is WordCount {
  return isValidWordCount(count);
}

/**
 * Validate batch count
 */
export function validateBatchCount(count: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(count) || count < 1) {
    return { valid: false, error: 'Count must be a positive integer' };
  }
  if (count > 10000) {
    return { valid: false, error: 'Count cannot exceed 10000' };
  }
  return { valid: true };
}

/**
 * Validate account count for HD derivation
 */
export function validateAccountCount(count: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(count) || count < 1) {
    return { valid: false, error: 'Account count must be a positive integer' };
  }
  if (count > 100) {
    return { valid: false, error: 'Account count cannot exceed 100' };
  }
  return { valid: true };
}

/**
 * Validate RPC URL format
 */
export function isValidRpcUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Sanitize string input to prevent injection
 */
export function sanitizeInput(input: string): string {
  return input.replace(/[^\w\s\-./':]/g, '').trim();
}

/**
 * Validate vanity search pattern (only valid base58 characters)
 */
export function isValidBase58Pattern(pattern: string): boolean {
  // Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  return base58Regex.test(pattern);
}

/**
 * Validate airdrop amount
 */
export function validateAirdropAmount(amount: number, network: SolanaNetwork): { valid: boolean; error?: string } {
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be positive' };
  }
  if (network === 'mainnet') {
    return { valid: false, error: 'Airdrop is not available on mainnet' };
  }
  if (amount > 2) {
    return { valid: false, error: 'Maximum airdrop amount is 2 SOL per request' };
  }
  return { valid: true };
}
