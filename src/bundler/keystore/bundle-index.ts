/** Non-encrypted bundle index — visible without password */
export interface BundleIndex {
  count: number;
  wallets: BundleIndexEntry[];
}

/** A single entry in the bundle index (public info only) */
export interface BundleIndexEntry {
  index: number;
  address: string;
  label?: string;
  tags?: string[];
  group?: string;
}

/** Bundle metadata */
export interface BundleMetadata {
  name: string;
  description: string;
  network: 'mainnet' | 'devnet';
  createdBy: string;
  createdAt: string;
  version: string;
}

/** Full wallet bundle file format (.swbundle) */
export interface WalletBundleFile {
  version: '2.0.0';
  format: 'solana-wallet-bundle';
  metadata: BundleMetadata;
  encryption: {
    algorithm: 'aes-256-gcm';
    kdf: 'argon2id';
    kdfParams: {
      salt: string;
      iterations: number;
      memory: number;
      parallelism: number;
      keyLen: number;
    };
    iv: string;
    tag: string;
  };
  index: BundleIndex;
  payload: string;
  checksum: string;
}

/** Internal wallet data stored in the encrypted payload */
export interface BundleWalletData {
  index: number;
  address: string;
  privateKey: string;
  label?: string;
  tags?: string[];
  group?: string;
}

/**
 * Build a bundle index from wallet data (strips private keys)
 */
export function buildBundleIndex(wallets: BundleWalletData[]): BundleIndex {
  return {
    count: wallets.length,
    wallets: wallets.map(w => ({
      index: w.index,
      address: w.address,
      label: w.label,
      tags: w.tags,
      group: w.group,
    })),
  };
}

/**
 * Filter index entries by various criteria
 */
export function filterIndex(
  index: BundleIndex,
  filter: {
    indices?: number[];
    labels?: string[];
    tags?: string[];
    groups?: string[];
  }
): BundleIndexEntry[] {
  let entries = index.wallets;

  if (filter.indices && filter.indices.length > 0) {
    entries = entries.filter(e => filter.indices!.includes(e.index));
  }

  if (filter.labels && filter.labels.length > 0) {
    entries = entries.filter(e => e.label && filter.labels!.includes(e.label));
  }

  if (filter.tags && filter.tags.length > 0) {
    entries = entries.filter(e =>
      e.tags && e.tags.some(t => filter.tags!.includes(t))
    );
  }

  if (filter.groups && filter.groups.length > 0) {
    entries = entries.filter(e => e.group && filter.groups!.includes(e.group));
  }

  return entries;
}
