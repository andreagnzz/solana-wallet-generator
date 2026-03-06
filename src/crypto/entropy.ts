import * as crypto from 'crypto';
import * as bip39 from 'bip39';
import { WordCount, MnemonicLanguage, ENTROPY_BITS } from '../types';

/**
 * Generate cryptographically secure random entropy
 * @param bits - Number of entropy bits (128, 160, 192, 224, or 256)
 * @returns Buffer containing random bytes
 */
export function generateEntropy(bits: number): Buffer {
  if (![128, 160, 192, 224, 256].includes(bits)) {
    throw new Error(`Invalid entropy bits: ${bits}. Must be 128, 160, 192, 224, or 256.`);
  }
  return crypto.randomBytes(bits / 8);
}

/**
 * Generate a BIP39 mnemonic phrase
 * @param wordCount - Number of mnemonic words (12, 15, 18, 21, or 24)
 * @param language - Mnemonic language
 * @returns Mnemonic phrase string
 */
export function generateMnemonic(
  wordCount: WordCount = 12,
  language: MnemonicLanguage = 'english'
): string {
  const bits = ENTROPY_BITS[wordCount];
  const entropy = generateEntropy(bits);

  setWordlist(language);
  const mnemonic = bip39.entropyToMnemonic(entropy.toString('hex'));

  // Zero out the entropy buffer
  entropy.fill(0);

  return mnemonic;
}

/**
 * Validate a BIP39 mnemonic phrase
 * @param mnemonic - The mnemonic phrase to validate
 * @param language - Expected language of the mnemonic
 * @returns true if the mnemonic is valid
 */
export function validateMnemonic(
  mnemonic: string,
  language: MnemonicLanguage = 'english'
): boolean {
  setWordlist(language);
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Convert mnemonic to seed bytes
 * @param mnemonic - The mnemonic phrase
 * @param passphrase - Optional BIP39 passphrase (25th word)
 * @returns Seed buffer (64 bytes)
 */
export async function mnemonicToSeed(
  mnemonic: string,
  passphrase?: string
): Promise<Buffer> {
  return bip39.mnemonicToSeed(mnemonic, passphrase || '');
}

/**
 * Set the BIP39 wordlist for the specified language
 */
function setWordlist(language: MnemonicLanguage): void {
  switch (language) {
    case 'english':
      bip39.setDefaultWordlist('english');
      break;
    case 'french':
      bip39.setDefaultWordlist('french');
      break;
    case 'spanish':
      bip39.setDefaultWordlist('spanish');
      break;
    case 'japanese':
      bip39.setDefaultWordlist('japanese');
      break;
    default:
      bip39.setDefaultWordlist('english');
  }
}

/**
 * Get the word count from a mnemonic string
 */
export function getMnemonicWordCount(mnemonic: string): number {
  return mnemonic.trim().split(/\s+/).length;
}

/**
 * Check if a word count is valid for BIP39
 */
export function isValidWordCount(count: number): count is WordCount {
  return [12, 15, 18, 21, 24].includes(count);
}
