import * as fs from 'fs';
import chalk from 'chalk';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { executeSweep, SweepConfig } from '../bundler/sweep/sweep-engine';
import { estimateSweep, formatSweepEstimate } from '../bundler/sweep/sweep-estimator';
import { unpackBundle } from '../bundler/keystore/bundle-unpack';
import { TipStrategy } from '../bundler/jito/jito-tip';
import { DEFAULT_RPC } from '../types';
import { isValidSolanaAddress } from '../utils/validation';
import { createSpinner, displaySuccess, displayWarning } from '../utils/display';
import { promptPassword } from '../crypto/keystore';
import boxen from 'boxen';

/** Options for the bundle-sweep CLI command */
export interface BundleSweepOptions {
  sourceFile?: string;
  sourceBundle?: string;
  destination: string;
  mode: 'sol-only' | 'tokens-only' | 'all';
  keepRent: boolean;
  keepMin?: number;
  useJito: boolean;
  tipStrategy: TipStrategy;
  concurrent: number;
  dryRun: boolean;
  output?: string;
  network: string;
}

/**
 * Execute the bundle-sweep CLI command
 */
export async function bundleSweepCommand(options: BundleSweepOptions): Promise<void> {
  // Validate destination
  if (!isValidSolanaAddress(options.destination)) {
    throw new Error(`Invalid destination address: ${options.destination}`);
  }

  const destination = new PublicKey(options.destination);

  // Load source wallets
  const sourceWallets = await loadSourceWallets(options);

  if (sourceWallets.length === 0) {
    throw new Error('No source wallets loaded');
  }

  console.log(chalk.cyan(`\n  Loaded ${sourceWallets.length} source wallets\n`));

  const rpcUrl = DEFAULT_RPC[options.network as keyof typeof DEFAULT_RPC] || DEFAULT_RPC.mainnet;
  const connection = new Connection(rpcUrl, 'confirmed');

  const config: SweepConfig = {
    sourceWallets,
    destination,
    mode: options.mode,
    keepRentExempt: options.keepRent,
    keepMinBalance: options.keepMin,
    useJito: options.useJito,
    jitoTipStrategy: options.tipStrategy,
    maxConcurrent: options.concurrent,
    simulateFirst: true,
    dryRun: options.dryRun,
  };

  if (options.dryRun) {
    displayWarning('Dry run mode: estimating sweep without sending');

    const spinner = createSpinner('Estimating sweep...');
    spinner.start();

    const estimate = await estimateSweep(connection, {
      sourceWallets,
      destination,
      mode: options.mode,
      keepRentExempt: options.keepRent,
      keepMinBalance: options.keepMin,
      useJito: options.useJito,
      jitoTipStrategy: options.tipStrategy,
    });

    spinner.succeed('Estimation complete');

    console.log(
      boxen(
        chalk.magenta.bold('  Sweep Estimate\n\n') +
        formatSweepEstimate(estimate).split('\n').map(l => '  ' + l).join('\n'),
        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'magenta' }
      )
    );
    return;
  }

  // Execute sweep
  const spinner = createSpinner(`Sweeping ${sourceWallets.length} wallets...`);
  spinner.start();

  const result = await executeSweep(connection, config);

  spinner.succeed('Sweep complete');

  // Display results
  console.log(
    boxen(
      chalk.magenta.bold('  Sweep Results\n\n') +
      chalk.cyan('  Wallets swept:   ') + chalk.green(result.walletsSwept.toString()) + '\n' +
      chalk.cyan('  Wallets skipped: ') + chalk.yellow(result.walletsSkipped.toString()) + '\n' +
      chalk.cyan('  Wallets errored: ') + chalk.red(result.walletsErrored.toString()) + '\n' +
      chalk.cyan('  SOL collected:   ') + chalk.yellow(`${(result.totalSolCollected / LAMPORTS_PER_SOL).toFixed(9)} SOL`) + '\n' +
      chalk.cyan('  Fees paid:       ') + chalk.gray(`${(result.totalFeePaid / LAMPORTS_PER_SOL).toFixed(9)} SOL`) + '\n' +
      chalk.cyan('  Net SOL:         ') + chalk.green.bold(`${(result.netSolCollected / LAMPORTS_PER_SOL).toFixed(9)} SOL`) + '\n' +
      chalk.cyan('  Duration:        ') + chalk.white(`${(result.executionTimeMs / 1000).toFixed(1)}s`),
      { padding: 1, margin: 1, borderStyle: 'double', borderColor: 'green' }
    )
  );

  // Save report if requested
  if (options.output) {
    const report = JSON.stringify(result, (_key, value) =>
      value instanceof Map ? Object.fromEntries(value) : value
    , 2);
    fs.writeFileSync(options.output, report, 'utf8');
    displaySuccess(`Report saved to ${options.output}`);
  }
}

/**
 * Load source wallets from file or bundle
 */
async function loadSourceWallets(
  options: BundleSweepOptions
): Promise<Array<{ keypair: Keypair; label?: string }>> {
  if (options.sourceBundle) {
    // Load from encrypted .swbundle
    const password = await promptPassword('Enter bundle password: ');
    const result = await unpackBundle({
      bundlePath: options.sourceBundle,
      password,
    });

    return result.wallets.map(w => ({
      keypair: w.keypair,
      label: w.label,
    }));
  }

  if (options.sourceFile) {
    // Load from JSON file (array of keypairs or wallet file)
    const raw = fs.readFileSync(options.sourceFile, 'utf8');
    const data = JSON.parse(raw);

    if (Array.isArray(data)) {
      return data.map((entry: { privateKey?: string; secretKey?: number[] }, i: number) => {
        if (entry.privateKey) {
          const secretKey = bs58.decode(entry.privateKey);
          return {
            keypair: Keypair.fromSecretKey(Uint8Array.from(secretKey)),
            label: `wallet-${i}`,
          };
        }
        if (entry.secretKey) {
          return {
            keypair: Keypair.fromSecretKey(Uint8Array.from(entry.secretKey)),
            label: `wallet-${i}`,
          };
        }
        throw new Error(`Invalid wallet entry at index ${i}`);
      });
    }

    // Single wallet file with accounts
    if (data.accounts) {
      return data.accounts
        .filter((a: { privateKey: string }) => a.privateKey && !a.privateKey.startsWith('***'))
        .map((a: { privateKey: string; index: number }) => ({
          keypair: Keypair.fromSecretKey(Uint8Array.from(bs58.decode(a.privateKey))),
          label: `account-${a.index}`,
        }));
    }

    throw new Error('Unrecognized wallet file format');
  }

  throw new Error('Provide --source-bundle or --source-file');
}
