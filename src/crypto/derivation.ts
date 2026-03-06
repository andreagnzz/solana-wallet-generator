import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import bs58 from 'bs58';
import { DerivedKeypair, DEFAULT_DERIVATION_PATH } from '../types';

/**
 * Derive a Solana keypair from a mnemonic using SLIP-0010 / ed25519
 * Compatible with Phantom, Solflare, Backpack, and Ledger
 *
 * @param mnemonic - BIP39 mnemonic phrase
 * @param index - Account index
 * @param passphrase - Optional BIP39 passphrase
 * @param customPath - Custom derivation path template (use {index} as placeholder)
 * @returns Derived keypair with public key, private key, and path info
 */
export function deriveSolanaKeypair(
  mnemonic: string,
  index: number,
  passphrase?: string,
  customPath?: string
): DerivedKeypair {
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase || '');
  const pathTemplate = customPath || DEFAULT_DERIVATION_PATH;
  const path = pathTemplate.replace('{index}', index.toString());

  const derived = derivePath(path, seed.toString('hex'));
  const keypair = Keypair.fromSeed(Uint8Array.from(derived.key));

  const publicKeyBase58 = keypair.publicKey.toBase58();
  const privateKeyBase58 = bs58.encode(Buffer.from(keypair.secretKey));
  const seedBase58 = bs58.encode(Buffer.from(derived.key));

  // Zero out sensitive buffers
  derived.key.fill(0);
  seed.fill(0);

  return {
    publicKey: publicKeyBase58,
    privateKey: privateKeyBase58,
    privateKeySeed: seedBase58,
    path,
    index,
  };
}

/**
 * Derive multiple Solana keypairs from a single mnemonic
 *
 * @param mnemonic - BIP39 mnemonic phrase
 * @param count - Number of accounts to derive
 * @param passphrase - Optional BIP39 passphrase
 * @param customPath - Custom derivation path template
 * @returns Array of derived keypairs
 */
export function deriveMultipleKeypairs(
  mnemonic: string,
  count: number,
  passphrase?: string,
  customPath?: string
): DerivedKeypair[] {
  if (count < 1 || count > 100) {
    throw new Error('Account count must be between 1 and 100');
  }

  const keypairs: DerivedKeypair[] = [];
  for (let i = 0; i < count; i++) {
    keypairs.push(deriveSolanaKeypair(mnemonic, i, passphrase, customPath));
  }
  return keypairs;
}

/**
 * Recover a keypair from a base58-encoded private key
 *
 * @param privateKeyBase58 - Base58 encoded private key (64 bytes)
 * @returns Keypair object
 */
export function keypairFromPrivateKey(privateKeyBase58: string): Keypair {
  const secretKey = bs58.decode(privateKeyBase58);
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

/**
 * Recover a keypair from a 32-byte seed
 *
 * @param seedBase58 - Base58 encoded seed (32 bytes)
 * @returns Keypair object
 */
export function keypairFromSeed(seedBase58: string): Keypair {
  const seed = bs58.decode(seedBase58);
  if (seed.length !== 32) {
    throw new Error('Seed must be exactly 32 bytes');
  }
  return Keypair.fromSeed(Uint8Array.from(seed));
}

/**
 * Get the derivation path for a specific wallet preset
 */
export function getDerivationPath(preset: string): string {
  switch (preset) {
    case 'phantom':
    case 'solflare':
    case 'backpack':
      return "m/44'/501'/{index}'/0'";
    case 'ledger-legacy':
      return "m/44'/501'/{index}'";
    case 'ledger-new':
      return "m/44'/501'/{account}'/0'/{index}'";
    default:
      return DEFAULT_DERIVATION_PATH;
  }
}

/**
 * Validate a derivation path format
 */
export function isValidDerivationPath(path: string): boolean {
  const pattern = /^m(\/\d+'?)*$/;
  // Allow {index} and {account} placeholders
  const normalized = path.replace(/\{index\}/g, '0').replace(/\{account\}/g, '0');
  return pattern.test(normalized);
}
