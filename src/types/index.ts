/** Supported mnemonic word counts */
export type WordCount = 12 | 15 | 18 | 21 | 24;

/** Supported mnemonic languages */
export type MnemonicLanguage = 'english' | 'french' | 'spanish' | 'japanese';

/** Supported Solana networks */
export type SolanaNetwork = 'mainnet' | 'devnet' | 'testnet' | 'custom';

/** Output format options */
export type OutputFormat = 'json' | 'csv' | 'jsonl' | 'env';

/** Derivation path presets */
export type DerivationPreset = 'phantom' | 'ledger-legacy' | 'ledger-new';

/** A derived keypair from HD derivation */
export interface DerivedKeypair {
  publicKey: string;
  privateKey: string;
  privateKeySeed: string;
  path: string;
  index: number;
}

/** Options for the generate command */
export interface GenerateOptions {
  words: WordCount;
  accounts: number;
  passphrase?: string;
  language: MnemonicLanguage;
  output?: string;
  encrypt: boolean;
  network: SolanaNetwork;
  showPrivate: boolean;
  qr: boolean;
  derivation?: string;
  format: OutputFormat;
}

/** Options for the vanity command */
export interface VanityOptions {
  prefix?: string;
  suffix?: string;
  contains?: string;
  caseSensitive: boolean;
  threads: number;
  save?: string;
  attemptsLog: boolean;
}

/** Options for the batch command */
export interface BatchOptions {
  count: number;
  output?: string;
  format: OutputFormat;
  encrypt: boolean;
  noPrivate: boolean;
  uniqueSeed: boolean;
  progress: boolean;
}

/** Options for the inspect command */
export interface InspectOptions {
  file?: string;
  mnemonic?: string;
  privateKey?: string;
  accounts: number;
  network: SolanaNetwork;
  showBalance: boolean;
  showTokens: boolean;
  decrypt: boolean;
}

/** Options for the balance command */
export interface BalanceOptions {
  address?: string;
  file?: string;
  network: SolanaNetwork;
  rpc?: string;
  tokens: boolean;
  nfts: boolean;
  history: number;
  watch: boolean;
}

/** Options for the airdrop command */
export interface AirdropOptions {
  address?: string;
  amount: number;
  network: SolanaNetwork;
  file?: string;
  delay: number;
}

/** Options for the sign command */
export interface SignOptions {
  message?: string;
  file?: string;
  privateKey?: string;
  verify: boolean;
  signature?: string;
  address?: string;
}

/** Encrypted keystore format */
export interface EncryptedKeystore {
  version: number;
  algorithm: 'aes-256-gcm';
  kdf: 'argon2id';
  kdfParams: {
    salt: string;
    iterations: number;
    memory: number;
    parallelism: number;
    keyLen: number;
  };
  cipher: {
    iv: string;
    tag: string;
    data: string;
  };
  checksum: string;
}

/** Wallet output file format */
export interface WalletFile {
  version: string;
  network: string;
  createdAt: string;
  mnemonic: string;
  passphraseUsed: boolean;
  derivationPath: string;
  accounts: WalletAccount[];
}

/** A single wallet account entry */
export interface WalletAccount {
  index: number;
  address: string;
  privateKey: string;
  path: string;
}

/** Token account info from SPL */
export interface TokenAccountInfo {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
}

/** Transaction history entry */
export interface TransactionEntry {
  signature: string;
  blockTime: number | null;
  slot: number;
  type: string;
}

/** Vanity search result */
export interface VanityResult {
  address: string;
  privateKey: string;
  attempts: number;
  duration: number;
}

/** Batch wallet entry for CSV export */
export interface BatchWalletEntry {
  index: number;
  address: string;
  privateKey: string;
  mnemonic: string;
  derivationPath: string;
  createdAt: string;
}

/** RPC endpoint configuration */
export interface RpcConfig {
  mainnet: string;
  devnet: string;
  testnet: string;
}

/** Entropy strength mapping for word counts */
export const ENTROPY_BITS: Record<WordCount, number> = {
  12: 128,
  15: 160,
  18: 192,
  21: 224,
  24: 256,
};

/** Default RPC endpoints */
export const DEFAULT_RPC: RpcConfig = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
};

/** Default derivation path template for Solana (Phantom/Solflare compatible) */
export const DEFAULT_DERIVATION_PATH = "m/44'/501'/{index}'/0'";

/** Solana coin type in BIP44 */
export const SOLANA_COIN_TYPE = 501;
