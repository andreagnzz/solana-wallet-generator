import * as fs from 'fs';
import * as crypto from 'crypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import argon2 from 'argon2';
import {
  WalletBundleFile,
  BundleMetadata,
  BundleWalletData,
  buildBundleIndex,
} from './bundle-index';

/** Configuration for packing wallets into a bundle */
export interface BundlePackConfig {
  wallets: Array<{
    keypair: Keypair;
    label?: string;
    tags?: string[];
    group?: string;
  }>;
  outputPath: string;
  password: string;
  metadata?: Partial<BundleMetadata>;
}

const ARGON2_ITERATIONS = 3;
const ARGON2_MEMORY = 65536;
const ARGON2_PARALLELISM = 4;
const KEY_LENGTH = 32;

/**
 * Pack multiple wallets into a single encrypted .swbundle file.
 *
 * The index (public addresses) remains unencrypted for inspection without password.
 * The payload (private keys) is encrypted with AES-256-GCM + Argon2id.
 *
 * @param config - Pack configuration
 * @returns Path of the created .swbundle file
 */
export async function packWallets(config: BundlePackConfig): Promise<string> {
  if (config.wallets.length === 0) {
    throw new Error('Cannot create an empty bundle');
  }

  if (config.password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Build wallet data
  const walletData: BundleWalletData[] = config.wallets.map((w, i) => ({
    index: i,
    address: w.keypair.publicKey.toBase58(),
    privateKey: bs58.encode(Buffer.from(w.keypair.secretKey)),
    label: w.label,
    tags: w.tags,
    group: w.group,
  }));

  // Build unencrypted index
  const index = buildBundleIndex(walletData);

  // Encrypt the payload (private keys + full metadata)
  const plaintext = JSON.stringify(walletData);
  const salt = crypto.randomBytes(32);

  const key = await argon2.hash(config.password, {
    type: argon2.argon2id,
    salt,
    timeCost: ARGON2_ITERATIONS,
    memoryCost: ARGON2_MEMORY,
    parallelism: ARGON2_PARALLELISM,
    hashLength: KEY_LENGTH,
    raw: true,
  });

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const checksum = crypto
    .createHash('sha256')
    .update(plaintext, 'utf8')
    .digest('hex');

  // Zero out key
  key.fill(0);

  const metadata: BundleMetadata = {
    name: config.metadata?.name || 'Wallet Bundle',
    description: config.metadata?.description || '',
    network: config.metadata?.network || 'mainnet',
    createdBy: config.metadata?.createdBy || '',
    createdAt: new Date().toISOString(),
    version: config.metadata?.version || '1.0.0',
  };

  const bundle: WalletBundleFile = {
    version: '2.0.0',
    format: 'solana-wallet-bundle',
    metadata,
    encryption: {
      algorithm: 'aes-256-gcm',
      kdf: 'argon2id',
      kdfParams: {
        salt: salt.toString('hex'),
        iterations: ARGON2_ITERATIONS,
        memory: ARGON2_MEMORY,
        parallelism: ARGON2_PARALLELISM,
        keyLen: KEY_LENGTH,
      },
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    },
    index,
    payload: encrypted.toString('hex'),
    checksum,
  };

  // Ensure output path has .swbundle extension
  const outputPath = config.outputPath.endsWith('.swbundle')
    ? config.outputPath
    : `${config.outputPath}.swbundle`;

  fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2), 'utf8');

  return outputPath;
}

/**
 * Add a wallet to an existing bundle file
 */
export async function addWalletToBundle(
  bundlePath: string,
  password: string,
  wallet: {
    keypair: Keypair;
    label?: string;
    tags?: string[];
    group?: string;
  }
): Promise<void> {
  // Load and decrypt existing bundle
  const { unpackBundle } = await import('./bundle-unpack');
  const result = await unpackBundle({
    bundlePath,
    password,
  });

  // Add new wallet
  const allWallets = [
    ...result.wallets.map(w => ({
      keypair: w.keypair,
      label: w.label,
      tags: w.tags,
      group: undefined as string | undefined,
    })),
    {
      keypair: wallet.keypair,
      label: wallet.label,
      tags: wallet.tags,
      group: wallet.group,
    },
  ];

  // Re-read metadata from original file
  const raw = fs.readFileSync(bundlePath, 'utf8');
  const original = JSON.parse(raw) as WalletBundleFile;

  // Re-pack with same password
  await packWallets({
    wallets: allWallets,
    outputPath: bundlePath,
    password,
    metadata: original.metadata,
  });
}

/**
 * Remove a wallet from a bundle by index
 */
export async function removeWalletFromBundle(
  bundlePath: string,
  password: string,
  indexToRemove: number
): Promise<void> {
  const { unpackBundle } = await import('./bundle-unpack');
  const result = await unpackBundle({ bundlePath, password });

  const filtered = result.wallets.filter(w => w.index !== indexToRemove);

  if (filtered.length === result.wallets.length) {
    throw new Error(`Wallet at index ${indexToRemove} not found`);
  }

  const raw = fs.readFileSync(bundlePath, 'utf8');
  const original = JSON.parse(raw) as WalletBundleFile;

  await packWallets({
    wallets: filtered.map(w => ({
      keypair: w.keypair,
      label: w.label,
      tags: w.tags,
    })),
    outputPath: bundlePath,
    password,
    metadata: original.metadata,
  });
}

/**
 * Merge multiple bundles into one
 */
export async function mergeBundles(
  bundlePaths: string[],
  passwords: string[],
  outputPath: string,
  newPassword: string
): Promise<void> {
  if (bundlePaths.length !== passwords.length) {
    throw new Error('Each bundle must have a corresponding password');
  }

  const { unpackBundle } = await import('./bundle-unpack');
  const allWallets: BundlePackConfig['wallets'] = [];

  for (let i = 0; i < bundlePaths.length; i++) {
    const result = await unpackBundle({
      bundlePath: bundlePaths[i],
      password: passwords[i],
    });

    for (const w of result.wallets) {
      allWallets.push({
        keypair: w.keypair,
        label: w.label,
        tags: w.tags,
      });
    }
  }

  await packWallets({
    wallets: allWallets,
    outputPath,
    password: newPassword,
    metadata: {
      name: 'Merged Bundle',
      description: `Merged from ${bundlePaths.length} bundles`,
    },
  });
}
