import * as fs from 'fs';
import chalk from 'chalk';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  executeDistribute,
  DistributeConfig,
} from '../bundler/distribute/distribute-engine';
import {
  DistributeTarget,
  DistributeStrategy,
} from '../bundler/distribute/distribute-strategy';
import { validateDistribution } from '../bundler/distribute/distribute-validator';
import { TipStrategy } from '../bundler/jito/jito-tip';
import { DEFAULT_RPC } from '../types';
import { isValidSolanaAddress } from '../utils/validation';
import { createSpinner, displaySuccess, displayError, displayWarning } from '../utils/display';
import boxen from 'boxen';

/** Options for the bundle-distribute CLI command */
export interface BundleDistributeOptions {
  sourceKey: string;
  destinations: string;
  token?: string;
  strategy: string;
  total?: number;
  targetBalance?: number;
  createAta: boolean;
  useJito: boolean;
  tipStrategy: TipStrategy;
  batchSize?: number;
  dryRun: boolean;
  output?: string;
  network: string;
}

/**
 * Execute the bundle-distribute CLI command
 */
export async function bundleDistributeCommand(options: BundleDistributeOptions): Promise<void> {
  // Load source keypair
  const keypairData = JSON.parse(fs.readFileSync(options.sourceKey, 'utf8'));
  const sourceKeypair = Array.isArray(keypairData)
    ? Keypair.fromSecretKey(Uint8Array.from(keypairData))
    : Keypair.fromSecretKey(Uint8Array.from(bs58.decode(keypairData.privateKey)));

  // Load destinations
  const destinations = loadDestinations(options.destinations);

  if (destinations.length === 0) {
    throw new Error('No valid destinations found');
  }

  console.log(chalk.cyan(`\n  Source: ${sourceKeypair.publicKey.toBase58()}`));
  console.log(chalk.cyan(`  Destinations: ${destinations.length}`));

  // Parse strategy
  const strategy = parseStrategy(options);

  // Parse token
  const token = options.token ? new PublicKey(options.token) : undefined;

  const rpcUrl = DEFAULT_RPC[options.network as keyof typeof DEFAULT_RPC] || DEFAULT_RPC.mainnet;
  const connection = new Connection(rpcUrl, 'confirmed');

  // Validate
  const spinner = createSpinner('Validating distribution...');
  spinner.start();

  const validation = await validateDistribution(
    connection,
    sourceKeypair,
    destinations,
    strategy,
    token,
    options.createAta
  );

  if (!validation.valid) {
    spinner.fail('Validation failed');
    for (const err of validation.errors) {
      displayError(err);
    }
    return;
  }

  spinner.succeed('Validation passed');

  // Show warnings
  for (const warn of validation.warnings) {
    displayWarning(warn);
  }

  // Show summary
  console.log(
    boxen(
      chalk.magenta.bold('  Distribution Summary\n\n') +
      chalk.cyan('  Total to send:  ') + chalk.yellow(`${(validation.summary.totalToSend / LAMPORTS_PER_SOL).toFixed(9)} SOL`) + '\n' +
      chalk.cyan('  Est. fees:      ') + chalk.gray(`${(validation.summary.estimatedFees / LAMPORTS_PER_SOL).toFixed(9)} SOL`) + '\n' +
      chalk.cyan('  ATA costs:      ') + chalk.gray(`${(validation.summary.estimatedAtaCosts / LAMPORTS_PER_SOL).toFixed(9)} SOL`) + '\n' +
      chalk.cyan('  Total required: ') + chalk.white(`${(validation.summary.totalRequired / LAMPORTS_PER_SOL).toFixed(9)} SOL`) + '\n' +
      chalk.cyan('  Source balance: ') + chalk.green(`${(validation.summary.sourceBalance / LAMPORTS_PER_SOL).toFixed(9)} SOL`) + '\n' +
      chalk.cyan('  Surplus:        ') + (validation.summary.surplus >= 0
        ? chalk.green(`${(validation.summary.surplus / LAMPORTS_PER_SOL).toFixed(9)} SOL`)
        : chalk.red(`${(validation.summary.surplus / LAMPORTS_PER_SOL).toFixed(9)} SOL`)),
      { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
    )
  );

  if (options.dryRun) {
    displayWarning('Dry run mode: distribution will not be executed');
    return;
  }

  // Execute distribution
  const config: DistributeConfig = {
    sourceKeypair,
    destinations,
    token,
    strategy,
    useJito: options.useJito,
    jitoTipStrategy: options.tipStrategy,
    createAtaIfMissing: options.createAta,
    maxConcurrent: 5,
    simulateFirst: true,
    dryRun: false,
  };

  spinner.start(`Distributing to ${destinations.length} addresses...`);

  const result = await executeDistribute(connection, config);

  spinner.succeed('Distribution complete');

  // Show results
  console.log(
    boxen(
      chalk.magenta.bold('  Distribution Results\n\n') +
      chalk.cyan('  Distributed: ') + chalk.yellow(`${(result.totalDistributed / LAMPORTS_PER_SOL).toFixed(9)} SOL`) + '\n' +
      chalk.cyan('  Success:     ') + chalk.green(result.successCount.toString()) + '\n' +
      chalk.cyan('  Failed:      ') + chalk.red(result.failureCount.toString()) + '\n' +
      chalk.cyan('  Skipped:     ') + chalk.yellow(result.skippedCount.toString()) + '\n' +
      chalk.cyan('  Fees:        ') + chalk.gray(`${(result.feePaid / LAMPORTS_PER_SOL).toFixed(9)} SOL`) + '\n' +
      chalk.cyan('  Duration:    ') + chalk.white(`${(result.executionTimeMs / 1000).toFixed(1)}s`),
      { padding: 1, margin: 1, borderStyle: 'double', borderColor: 'green' }
    )
  );

  // Save report
  if (options.output) {
    fs.writeFileSync(options.output, JSON.stringify(result, null, 2), 'utf8');
    displaySuccess(`Report saved to ${options.output}`);
  }
}

/**
 * Parse strategy from CLI options
 */
function parseStrategy(options: BundleDistributeOptions): DistributeStrategy {
  switch (options.strategy) {
    case 'equal':
      if (!options.total) throw new Error('--total is required for equal strategy');
      return { type: 'equal', totalAmount: options.total };
    case 'weighted':
      if (!options.total) throw new Error('--total is required for weighted strategy');
      return { type: 'weighted', totalAmount: options.total };
    case 'fixed':
      return { type: 'fixed' };
    case 'fill-to':
      if (!options.targetBalance) throw new Error('--target-balance is required for fill-to strategy');
      return { type: 'fill-to', targetBalance: options.targetBalance };
    default:
      throw new Error(`Unknown strategy: ${options.strategy}`);
  }
}

/**
 * Load destinations from a CSV or JSON file
 */
function loadDestinations(filepath: string): DistributeTarget[] {
  if (!fs.existsSync(filepath)) {
    throw new Error(`Destinations file not found: ${filepath}`);
  }

  const raw = fs.readFileSync(filepath, 'utf8');

  // Try JSON first
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return data
        .filter((entry: { address: string }) => isValidSolanaAddress(entry.address))
        .map((entry: { address: string; label?: string; amount?: number; weight?: number }) => ({
          address: new PublicKey(entry.address),
          label: entry.label,
          amount: entry.amount,
          weight: entry.weight,
        }));
    }
  } catch {
    // Not JSON, try CSV
  }

  // Parse CSV (simple: address per line or address,amount)
  const lines = raw.trim().split('\n');
  const targets: DistributeTarget[] = [];

  for (const line of lines) {
    const parts = line.trim().split(',');
    const address = parts[0].trim();

    if (!isValidSolanaAddress(address)) continue;

    targets.push({
      address: new PublicKey(address),
      amount: parts[1] ? parseInt(parts[1].trim(), 10) : undefined,
      weight: parts[2] ? parseFloat(parts[2].trim()) : undefined,
    });
  }

  return targets;
}
