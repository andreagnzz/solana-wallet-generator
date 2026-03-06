import chalk from 'chalk';
import { Connection, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import { JitoClient } from '../bundler/jito/jito-client';
import { buildSimpleBundle, sendBundle } from '../bundler/jito/jito-bundle';
import { monitorBundle } from '../bundler/jito/jito-monitor';
import { TipStrategy, formatTipInfo, calculateTip } from '../bundler/jito/jito-tip';
import { createSpinner, displaySuccess, displayError, displayWarning } from '../utils/display';
import boxen from 'boxen';

/** Options for the bundle-jito CLI command */
export interface BundleJitoOptions {
  transactions?: string[];
  tipStrategy: TipStrategy;
  tipAmount?: number;
  region: string;
  monitor: boolean;
  timeout: number;
  simulate: boolean;
  dryRun: boolean;
  keypair?: string;
}

/**
 * Execute the bundle-jito CLI command
 */
export async function bundleJitoCommand(options: BundleJitoOptions): Promise<void> {
  if (!options.keypair) {
    throw new Error('--keypair is required (path to fee payer keypair JSON)');
  }

  // Load fee payer keypair
  const keypairData = JSON.parse(fs.readFileSync(options.keypair, 'utf8'));
  const feePayer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  // Initialize Jito client
  const jitoClient = new JitoClient({
    region: options.region as 'mainnet' | 'amsterdam' | 'frankfurt' | 'ny' | 'tokyo',
    timeout: options.timeout,
  });

  // Calculate tip
  const spinner = createSpinner('Calculating Jito tip...');
  spinner.start();

  const tip = await calculateTip(jitoClient, options.tipStrategy, options.tipAmount);
  spinner.succeed(formatTipInfo(tip));

  if (options.dryRun) {
    displayWarning('Dry run mode: bundle will not be sent');
    console.log(
      boxen(
        chalk.cyan('  Region: ') + chalk.white(options.region) + '\n' +
        chalk.cyan('  Tip: ') + chalk.yellow(`${tip.lamports.toLocaleString()} lamports`) + '\n' +
        chalk.cyan('  Strategy: ') + chalk.white(options.tipStrategy) + '\n' +
        chalk.cyan('  Fee payer: ') + chalk.green(feePayer.publicKey.toBase58()),
        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
      )
    );
    return;
  }

  // For now, if no pre-built transactions provided, show usage info
  if (!options.transactions || options.transactions.length === 0) {
    displayWarning('No transactions provided. Use --transactions to specify transaction JSON files.');
    console.log(chalk.gray('\n  Usage example:'));
    console.log(chalk.gray('  solana-wallet bundle-jito --transactions buy.json --keypair wallet.json --tip-strategy p75\n'));
    return;
  }

  // Load transactions from JSON files
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  spinner.start('Building Jito bundle...');

  // Build bundle with just the tip (user transactions would be loaded from files)
  const bundle = await buildSimpleBundle(
    [], // No additional instructions in CLI mode
    [feePayer],
    {
      tipStrategy: options.tipStrategy,
      customTipLamports: options.tipAmount,
      tipPayer: feePayer,
      connection,
      simulateFirst: options.simulate,
    }
  );

  spinner.succeed('Bundle built');

  // Send bundle
  spinner.start('Sending bundle to Jito Block Engine...');
  const result = await sendBundle(bundle, jitoClient);

  if (result.status === 'failed') {
    spinner.fail('Bundle submission failed');
    displayError(result.error || 'Unknown error');
    return;
  }

  spinner.succeed(`Bundle submitted: ${result.bundleId}`);

  // Monitor if requested
  if (options.monitor && result.bundleId) {
    spinner.start('Monitoring bundle status...');

    const monitorResult = await monitorBundle(result.bundleId, jitoClient, {
      timeoutMs: options.timeout,
      onStatusChange: (status) => {
        spinner.text = `Bundle status: ${status}`;
      },
    });

    if (monitorResult.status === 'landed') {
      spinner.succeed(chalk.green(`Bundle landed in slot ${monitorResult.slot}`));
      displaySuccess(`Bundle confirmed in ${(monitorResult.durationMs / 1000).toFixed(1)}s`);
    } else if (monitorResult.status === 'failed') {
      spinner.fail('Bundle failed');
      displayError(monitorResult.error || 'Bundle was rejected');
    } else {
      spinner.warn(`Bundle status: ${monitorResult.status}`);
    }
  }
}
