import * as fs from 'fs';
import chalk from 'chalk';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { packWallets, addWalletToBundle, mergeBundles } from '../bundler/keystore/bundle-pack';
import { unpackBundle, listBundle, bundleInfo } from '../bundler/keystore/bundle-unpack';
import { promptPassword, promptPasswordWithConfirm } from '../crypto/keystore';
import { createSpinner, displayFileSaved } from '../utils/display';
import boxen from 'boxen';

/** Options for bundle-pack command */
export interface BundlePackOptions {
  input: string[];
  output: string;
  name?: string;
  description?: string;
  network: string;
}

/** Options for bundle-list command */
export interface BundleListOptions {
  file: string;
}

/** Options for bundle-unpack command */
export interface BundleUnpackOptions {
  file: string;
  indices?: string;
  labels?: string;
  tags?: string;
  outputDir?: string;
  format: string;
}

/** Options for bundle-merge command */
export interface BundleMergeOptions {
  files: string[];
  output: string;
}

/** Options for bundle-add command */
export interface BundleAddOptions {
  file: string;
  wallet: string;
  label?: string;
  tags?: string;
}

/**
 * Pack wallets into an encrypted .swbundle file
 */
export async function bundlePackCommand(options: BundlePackOptions): Promise<void> {
  // Load wallets from input files
  const wallets = loadWalletsFromFiles(options.input);

  if (wallets.length === 0) {
    throw new Error('No wallets found in input files');
  }

  console.log(chalk.cyan(`\n  Found ${wallets.length} wallets to pack\n`));

  const password = await promptPasswordWithConfirm();

  const spinner = createSpinner('Packing wallets...');
  spinner.start();

  const outputPath = await packWallets({
    wallets,
    outputPath: options.output,
    password,
    metadata: {
      name: options.name || 'Wallet Bundle',
      description: options.description || '',
      network: options.network as 'mainnet' | 'devnet',
    },
  });

  spinner.succeed(`Packed ${wallets.length} wallets`);
  displayFileSaved(outputPath, true);
}

/**
 * List wallets in a bundle (no password required)
 */
export async function bundleListCommand(options: BundleListOptions): Promise<void> {
  const spinner = createSpinner('Reading bundle...');
  spinner.start();

  const index = await listBundle(options.file);
  const metadata = await bundleInfo(options.file);

  spinner.succeed(`Bundle: ${metadata.name}`);

  console.log(
    boxen(
      chalk.magenta.bold(`  ${metadata.name}\n\n`) +
      chalk.cyan('  Network:     ') + chalk.white(metadata.network) + '\n' +
      chalk.cyan('  Created:     ') + chalk.gray(metadata.createdAt) + '\n' +
      chalk.cyan('  Description: ') + chalk.white(metadata.description || 'N/A') + '\n' +
      chalk.cyan('  Wallets:     ') + chalk.yellow(index.count.toString()),
      { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'magenta' }
    )
  );

  // List wallets
  console.log(chalk.magenta.bold('\n  Wallet Index\n'));
  console.log(
    chalk.cyan('  #'.padEnd(6)) +
    chalk.cyan('Address'.padEnd(48)) +
    chalk.cyan('Label'.padEnd(20)) +
    chalk.cyan('Tags')
  );
  console.log(chalk.gray('  ' + '-'.repeat(90)));

  for (const w of index.wallets) {
    console.log(
      chalk.white(`  ${w.index.toString().padEnd(4)}`) +
      chalk.green(w.address.padEnd(48)) +
      chalk.white((w.label || '').padEnd(20)) +
      chalk.gray((w.tags || []).join(', '))
    );
  }
  console.log();
}

/**
 * Unpack wallets from a bundle
 */
export async function bundleUnpackCommand(options: BundleUnpackOptions): Promise<void> {
  const password = await promptPassword('Enter bundle password: ');

  const spinner = createSpinner('Unpacking bundle...');
  spinner.start();

  const result = await unpackBundle({
    bundlePath: options.file,
    password,
    extract: {
      indices: options.indices ? options.indices.split(',').map(Number) : undefined,
      labels: options.labels ? options.labels.split(',') : undefined,
      tags: options.tags ? options.tags.split(',') : undefined,
    },
    outputDir: options.outputDir,
    format: options.format as 'json' | 'keypair',
  });

  spinner.succeed(`Extracted ${result.wallets.length} wallets`);

  for (const w of result.wallets) {
    console.log(
      chalk.cyan(`  #${w.index}`) + ' ' +
      chalk.green(w.address) + ' ' +
      chalk.gray(w.label || '')
    );
  }

  if (result.outputFiles && result.outputFiles.length > 0) {
    console.log(chalk.green(`\n  Saved ${result.outputFiles.length} files to ${options.outputDir}\n`));
  }
}

/**
 * Merge multiple bundles into one
 */
export async function bundleMergeCommand(options: BundleMergeOptions): Promise<void> {
  const passwords: string[] = [];

  for (let i = 0; i < options.files.length; i++) {
    const pw = await promptPassword(`Password for ${options.files[i]}: `);
    passwords.push(pw);
  }

  const newPassword = await promptPasswordWithConfirm();

  const spinner = createSpinner('Merging bundles...');
  spinner.start();

  await mergeBundles(options.files, passwords, options.output, newPassword);

  spinner.succeed('Bundles merged');
  displayFileSaved(options.output, true);
}

/**
 * Add a wallet to an existing bundle
 */
export async function bundleAddCommand(options: BundleAddOptions): Promise<void> {
  const password = await promptPassword('Enter bundle password: ');

  // Load wallet
  const walletData = JSON.parse(fs.readFileSync(options.wallet, 'utf8'));
  let keypair: Keypair;

  if (Array.isArray(walletData)) {
    keypair = Keypair.fromSecretKey(Uint8Array.from(walletData));
  } else if (walletData.privateKey) {
    keypair = Keypair.fromSecretKey(Uint8Array.from(bs58.decode(walletData.privateKey)));
  } else {
    throw new Error('Invalid wallet file format');
  }

  const spinner = createSpinner('Adding wallet to bundle...');
  spinner.start();

  await addWalletToBundle(options.file, password, {
    keypair,
    label: options.label,
    tags: options.tags ? options.tags.split(',') : undefined,
  });

  spinner.succeed(`Added ${keypair.publicKey.toBase58().substring(0, 12)}... to bundle`);
}

/**
 * Load wallets from JSON files or Solana CLI keypair files
 */
function loadWalletsFromFiles(
  paths: string[]
): Array<{ keypair: Keypair; label?: string }> {
  const wallets: Array<{ keypair: Keypair; label?: string }> = [];

  for (const filePath of paths) {
    // Handle glob-like patterns by checking if it's a directory
    const resolvedPaths = fs.existsSync(filePath) ? [filePath] : [];

    for (const p of resolvedPaths) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const data = JSON.parse(raw);

        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'number') {
          // Solana CLI keypair format [u8; 64]
          wallets.push({
            keypair: Keypair.fromSecretKey(Uint8Array.from(data)),
            label: p.split('/').pop()?.replace('.json', ''),
          });
        } else if (data.privateKey) {
          wallets.push({
            keypair: Keypair.fromSecretKey(Uint8Array.from(bs58.decode(data.privateKey))),
            label: data.label || p.split('/').pop()?.replace('.json', ''),
          });
        } else if (data.accounts && Array.isArray(data.accounts)) {
          for (const acc of data.accounts) {
            if (acc.privateKey && !acc.privateKey.startsWith('***')) {
              wallets.push({
                keypair: Keypair.fromSecretKey(Uint8Array.from(bs58.decode(acc.privateKey))),
                label: `account-${acc.index}`,
              });
            }
          }
        }
      } catch {
        console.warn(chalk.yellow(`  Warning: Could not load ${p}`));
      }
    }
  }

  return wallets;
}
