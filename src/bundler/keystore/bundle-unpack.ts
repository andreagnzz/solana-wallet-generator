import * as fs from 'fs';
import * as crypto from 'crypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import argon2 from 'argon2';
import {
  WalletBundleFile,
  BundleIndex,
  BundleMetadata,
  BundleWalletData,
} from './bundle-index';

/** Configuration for unpacking a bundle */
export interface BundleUnpackConfig {
  bundlePath: string;
  password: string;
  extract?: {
    indices?: number[];
    labels?: string[];
    tags?: string[];
    groups?: string[];
  };
  outputDir?: string;
  format?: 'json' | 'keypair';
}

/** Result of unpacking */
export interface UnpackResult {
  wallets: Array<{
    index: number;
    address: string;
    keypair: Keypair;
    label?: string;
    tags?: string[];
  }>;
  outputFiles?: string[];
}

/**
 * Read a bundle file and return its structure (without decrypting)
 */
function readBundleFile(bundlePath: string): WalletBundleFile {
  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Bundle file not found: ${bundlePath}`);
  }

  const raw = fs.readFileSync(bundlePath, 'utf8');
  const bundle = JSON.parse(raw) as WalletBundleFile;

  if (bundle.format !== 'solana-wallet-bundle') {
    throw new Error('Invalid bundle format');
  }

  if (bundle.version !== '2.0.0') {
    throw new Error(`Unsupported bundle version: ${bundle.version}`);
  }

  return bundle;
}

/**
 * List wallets in a bundle without decrypting (public info only)
 */
export async function listBundle(bundlePath: string): Promise<BundleIndex> {
  const bundle = readBundleFile(bundlePath);
  return bundle.index;
}

/**
 * Get bundle metadata without decrypting
 */
export async function bundleInfo(bundlePath: string): Promise<BundleMetadata> {
  const bundle = readBundleFile(bundlePath);
  return bundle.metadata;
}

/**
 * Decrypt and extract wallets from a bundle
 */
export async function unpackBundle(config: BundleUnpackConfig): Promise<UnpackResult> {
  const bundle = readBundleFile(config.bundlePath);

  // Decrypt payload
  const salt = Buffer.from(bundle.encryption.kdfParams.salt, 'hex');
  const key = await argon2.hash(config.password, {
    type: argon2.argon2id,
    salt,
    timeCost: bundle.encryption.kdfParams.iterations,
    memoryCost: bundle.encryption.kdfParams.memory,
    parallelism: bundle.encryption.kdfParams.parallelism,
    hashLength: bundle.encryption.kdfParams.keyLen,
    raw: true,
  });

  const iv = Buffer.from(bundle.encryption.iv, 'hex');
  const tag = Buffer.from(bundle.encryption.tag, 'hex');
  const encryptedData = Buffer.from(bundle.payload, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted: string;
  try {
    decrypted = decipher.update(encryptedData) + decipher.final('utf8');
  } catch {
    key.fill(0);
    throw new Error('Decryption failed: invalid password or corrupted bundle');
  }

  key.fill(0);

  // Verify checksum
  const checksum = crypto.createHash('sha256').update(decrypted, 'utf8').digest('hex');
  if (checksum !== bundle.checksum) {
    throw new Error('Checksum verification failed: bundle may be corrupted');
  }

  // Parse wallet data
  let walletData: BundleWalletData[] = JSON.parse(decrypted);

  // Apply filters
  if (config.extract) {
    walletData = filterWallets(walletData, config.extract);
  }

  // Convert to keypairs
  const wallets = walletData.map(w => ({
    index: w.index,
    address: w.address,
    keypair: Keypair.fromSecretKey(Uint8Array.from(bs58.decode(w.privateKey))),
    label: w.label,
    tags: w.tags,
  }));

  // Save to files if outputDir specified
  let outputFiles: string[] | undefined;
  if (config.outputDir) {
    outputFiles = saveExtractedWallets(wallets, config.outputDir, config.format || 'json');
  }

  return { wallets, outputFiles };
}

/**
 * Filter wallets by various criteria
 */
function filterWallets(
  wallets: BundleWalletData[],
  filter: NonNullable<BundleUnpackConfig['extract']>
): BundleWalletData[] {
  let result = wallets;

  if (filter.indices && filter.indices.length > 0) {
    result = result.filter(w => filter.indices!.includes(w.index));
  }

  if (filter.labels && filter.labels.length > 0) {
    result = result.filter(w => w.label && filter.labels!.includes(w.label));
  }

  if (filter.tags && filter.tags.length > 0) {
    result = result.filter(w =>
      w.tags && w.tags.some(t => filter.tags!.includes(t))
    );
  }

  if (filter.groups && filter.groups.length > 0) {
    result = result.filter(w => w.group && filter.groups!.includes(w.group));
  }

  return result;
}

/**
 * Save extracted wallets to individual files
 */
function saveExtractedWallets(
  wallets: UnpackResult['wallets'],
  outputDir: string,
  format: 'json' | 'keypair'
): string[] {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files: string[] = [];

  for (const w of wallets) {
    const filename = `wallet-${w.index}-${w.address.substring(0, 8)}`;

    if (format === 'keypair') {
      // Solana CLI keypair format (JSON array of bytes)
      const filepath = `${outputDir}/${filename}.json`;
      fs.writeFileSync(filepath, JSON.stringify(Array.from(w.keypair.secretKey)), 'utf8');
      files.push(filepath);
    } else {
      // Custom JSON format
      const filepath = `${outputDir}/${filename}.json`;
      const data = {
        address: w.address,
        privateKey: bs58.encode(Buffer.from(w.keypair.secretKey)),
        label: w.label,
        tags: w.tags,
        index: w.index,
      };
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
      files.push(filepath);
    }
  }

  return files;
}
