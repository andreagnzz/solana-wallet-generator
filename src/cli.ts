#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { renderCommandBanner, renderMainBanner } from './ui';
import {
  GenerateOptions,
  VanityOptions,
  BatchOptions,
  InspectOptions,
  BalanceOptions,
  AirdropOptions,
  SignOptions,
  WordCount,
  MnemonicLanguage,
  SolanaNetwork,
  OutputFormat,
} from './types';
import { generateCommand } from './commands/generate';
import { vanityCommand } from './commands/vanity';
import { batchCommand } from './commands/batch';
import { inspectCommand } from './commands/inspect';
import { balanceCommand } from './commands/balance';
import { airdropCommand } from './commands/airdrop';
import { signCommand } from './commands/sign';
import { bundleJitoCommand } from './commands/bundle-jito';
import { bundleSweepCommand } from './commands/bundle-sweep';
import { bundleDistributeCommand } from './commands/bundle-distribute';
import {
  bundlePackCommand,
  bundleListCommand,
  bundleUnpackCommand,
  bundleMergeCommand,
  bundleAddCommand,
} from './commands/bundle-pack';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('solana-wallet')
  .description(chalk.magenta('Professional Solana Wallet Generator CLI'))
  .version('1.0.0');

// ─── GENERATE ───────────────────────────────────────────────
program
  .command('generate')
  .description('Generate a new HD wallet with BIP39 mnemonic')
  .option('-w, --words <number>', 'Mnemonic word count: 12|15|18|21|24', '12')
  .option('-a, --accounts <number>', 'Number of accounts to derive', '1')
  .option('-p, --passphrase <string>', 'BIP39 passphrase (25th word)')
  .option('-l, --language <lang>', 'Mnemonic language: english|french|spanish|japanese', 'english')
  .option('-o, --output <path>', 'Output file path')
  .option('-e, --encrypt', 'Encrypt the output file', false)
  .option('-n, --network <net>', 'Network: mainnet|devnet|testnet', 'mainnet')
  .option('--show-private', 'Show private keys in output', false)
  .option('--qr', 'Display QR codes for addresses', false)
  .option('--derivation <path>', 'Custom derivation path')
  .option('--format <fmt>', 'Output format: json|csv|jsonl', 'json')
  .action(async (opts) => {
    renderCommandBanner('generate', 'Create HD wallet with BIP39 mnemonic');
    try {
      const options: GenerateOptions = {
        words: parseInt(opts.words, 10) as WordCount,
        accounts: parseInt(opts.accounts, 10),
        passphrase: opts.passphrase,
        language: opts.language as MnemonicLanguage,
        output: opts.output,
        encrypt: opts.encrypt,
        network: opts.network as SolanaNetwork,
        showPrivate: opts.showPrivate,
        qr: opts.qr,
        derivation: opts.derivation,
        format: opts.format as OutputFormat,
      };
      await generateCommand(options);
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── VANITY ─────────────────────────────────────────────────
program
  .command('vanity')
  .description('Generate a vanity address with custom prefix/suffix')
  .option('--prefix <string>', 'Desired address prefix')
  .option('--suffix <string>', 'Desired address suffix')
  .option('--contains <string>', 'String contained anywhere in address')
  .option('--case-sensitive', 'Case-sensitive matching', false)
  .option('--threads <number>', 'Number of worker threads', String(Math.max(1, require('os').cpus().length - 1)))
  .option('--save <path>', 'Save found wallet to file')
  .option('--attempts-log', 'Show attempts counter', false)
  .action(async (opts) => {
    renderCommandBanner('vanity', 'Generate vanity address');
    try {
      const options: VanityOptions = {
        prefix: opts.prefix,
        suffix: opts.suffix,
        contains: opts.contains,
        caseSensitive: opts.caseSensitive,
        threads: parseInt(opts.threads, 10),
        save: opts.save,
        attemptsLog: opts.attemptsLog,
      };
      await vanityCommand(options);
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── BATCH ──────────────────────────────────────────────────
program
  .command('batch')
  .description('Generate multiple wallets in batch')
  .option('-n, --count <number>', 'Number of wallets to generate', '10')
  .option('-o, --output <path>', 'Output file path')
  .option('--format <fmt>', 'Output format: csv|json|jsonl', 'csv')
  .option('--encrypt', 'Encrypt private keys', false)
  .option('--no-private', 'Exclude private keys from output')
  .option('--unique-seed', 'Use unique mnemonic per wallet', false)
  .option('--progress', 'Show progress bar', false)
  .action(async (opts) => {
    renderCommandBanner('batch', 'Generate multiple wallets');
    try {
      const options: BatchOptions = {
        count: parseInt(opts.count, 10),
        output: opts.output,
        format: opts.format as OutputFormat,
        encrypt: opts.encrypt,
        noPrivate: opts.private === false,
        uniqueSeed: opts.uniqueSeed,
        progress: opts.progress,
      };
      await batchCommand(options);
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── INSPECT ────────────────────────────────────────────────
program
  .command('inspect')
  .description('Inspect an existing wallet or mnemonic')
  .option('--file <path>', 'Wallet JSON file to inspect')
  .option('--mnemonic <phrase>', 'Mnemonic phrase to inspect')
  .option('--private-key <key>', 'Private key to inspect')
  .option('-a, --accounts <number>', 'Number of accounts to derive', '5')
  .option('-n, --network <net>', 'Network for balance checks', 'mainnet')
  .option('--show-balance', 'Fetch SOL balances', false)
  .option('--show-tokens', 'Fetch SPL token accounts', false)
  .option('--decrypt', 'Decrypt encrypted wallet file', false)
  .action(async (opts) => {
    try {
      const options: InspectOptions = {
        file: opts.file,
        mnemonic: opts.mnemonic,
        privateKey: opts.privateKey,
        accounts: parseInt(opts.accounts, 10),
        network: opts.network as SolanaNetwork,
        showBalance: opts.showBalance,
        showTokens: opts.showTokens,
        decrypt: opts.decrypt,
      };
      await inspectCommand(options);
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── BALANCE ────────────────────────────────────────────────
program
  .command('balance')
  .description('Check SOL balance and token accounts')
  .option('--address <pubkey>', 'Solana public address')
  .option('--file <path>', 'Wallet file with addresses')
  .option('-n, --network <net>', 'Network: mainnet|devnet|testnet', 'mainnet')
  .option('--rpc <url>', 'Custom RPC URL')
  .option('--tokens', 'Show SPL token accounts', false)
  .option('--nfts', 'Show NFTs', false)
  .option('--history <number>', 'Show last N transactions', '5')
  .option('--watch', 'Watch mode: refresh every 10s', false)
  .action(async (opts) => {
    try {
      const options: BalanceOptions = {
        address: opts.address,
        file: opts.file,
        network: opts.network as SolanaNetwork,
        rpc: opts.rpc,
        tokens: opts.tokens,
        nfts: opts.nfts,
        history: parseInt(opts.history, 10),
        watch: opts.watch,
      };
      await balanceCommand(options);
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── AIRDROP ────────────────────────────────────────────────
program
  .command('airdrop')
  .description('Request SOL airdrop on devnet/testnet')
  .option('--address <pubkey>', 'Destination address')
  .option('--amount <sol>', 'SOL amount (max 2)', '1')
  .option('-n, --network <net>', 'Network: devnet|testnet', 'devnet')
  .option('--file <path>', 'Airdrop to all addresses in file')
  .option('--delay <ms>', 'Delay between airdrops in ms', '1000')
  .action(async (opts) => {
    try {
      const options: AirdropOptions = {
        address: opts.address,
        amount: parseFloat(opts.amount),
        network: opts.network as SolanaNetwork,
        file: opts.file,
        delay: parseInt(opts.delay, 10),
      };
      await airdropCommand(options);
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── SIGN ───────────────────────────────────────────────────
program
  .command('sign')
  .description('Sign or verify a message')
  .option('--message <text>', 'Message to sign')
  .option('--file <path>', 'Wallet file with private key')
  .option('--private-key <key>', 'Base58 private key')
  .option('--verify', 'Verify mode', false)
  .option('--signature <sig>', 'Signature to verify')
  .option('--address <pubkey>', 'Public address for verification')
  .action(async (opts) => {
    try {
      const options: SignOptions = {
        message: opts.message,
        file: opts.file,
        privateKey: opts.privateKey,
        verify: opts.verify,
        signature: opts.signature,
        address: opts.address,
      };
      await signCommand(options);
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── BUNDLE-JITO ────────────────────────────────────────────
program
  .command('bundle-jito')
  .description('Send atomic transaction bundle via Jito Block Engine')
  .option('--transactions <paths...>', 'Transaction JSON files')
  .option('--tip-strategy <strategy>', 'Tip strategy: min|p25|p50|p75|p95|custom', 'p50')
  .option('--tip-amount <lamports>', 'Custom tip amount in lamports')
  .option('--region <region>', 'Jito region: mainnet|amsterdam|frankfurt|ny|tokyo', 'mainnet')
  .option('--monitor', 'Monitor bundle until landing', true)
  .option('--timeout <ms>', 'Monitoring timeout', '60000')
  .option('--simulate', 'Simulate before sending', false)
  .option('--dry-run', 'Build without sending', false)
  .option('--keypair <path>', 'Fee payer keypair JSON file')
  .action(async (opts) => {
    renderCommandBanner('bundle-jito', 'Send Jito MEV bundle');
    try {
      await bundleJitoCommand({
        transactions: opts.transactions,
        tipStrategy: opts.tipStrategy,
        tipAmount: opts.tipAmount ? parseInt(opts.tipAmount, 10) : undefined,
        region: opts.region,
        monitor: opts.monitor,
        timeout: parseInt(opts.timeout, 10),
        simulate: opts.simulate,
        dryRun: opts.dryRun,
        keypair: opts.keypair,
      });
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── BUNDLE-SWEEP ───────────────────────────────────────────
program
  .command('bundle-sweep')
  .description('Sweep SOL/tokens from multiple wallets to one destination')
  .option('--source-file <path>', 'JSON file with source wallets')
  .option('--source-bundle <path>', 'Encrypted .swbundle file')
  .option('--destination <address>', 'Destination address')
  .option('--mode <mode>', 'Sweep mode: sol-only|tokens-only|all', 'all')
  .option('--keep-rent', 'Keep rent exemption balance', true)
  .option('--keep-min <lamports>', 'Minimum balance to keep')
  .option('--use-jito', 'Use Jito for atomicity', false)
  .option('--tip-strategy <strategy>', 'Jito tip strategy', 'p25')
  .option('--concurrent <n>', 'Parallel wallets', '5')
  .option('--dry-run', 'Estimate without sending', false)
  .option('--output <path>', 'Save sweep report')
  .option('-n, --network <net>', 'Network', 'mainnet')
  .action(async (opts) => {
    renderCommandBanner('bundle-sweep', 'Sweep wallets to destination');
    try {
      await bundleSweepCommand({
        sourceFile: opts.sourceFile,
        sourceBundle: opts.sourceBundle,
        destination: opts.destination,
        mode: opts.mode,
        keepRent: opts.keepRent,
        keepMin: opts.keepMin ? parseInt(opts.keepMin, 10) : undefined,
        useJito: opts.useJito,
        tipStrategy: opts.tipStrategy,
        concurrent: parseInt(opts.concurrent, 10),
        dryRun: opts.dryRun,
        output: opts.output,
        network: opts.network,
      });
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── BUNDLE-DISTRIBUTE ─────────────────────────────────────
program
  .command('bundle-distribute')
  .description('Distribute SOL/tokens from one wallet to many')
  .option('--source-key <path>', 'Source keypair JSON file')
  .option('--destinations <path>', 'Destinations JSON/CSV file')
  .option('--token <mint>', 'SPL token mint (omit for native SOL)')
  .option('--strategy <strategy>', 'Strategy: equal|weighted|fixed|fill-to', 'equal')
  .option('--total <amount>', 'Total amount in lamports')
  .option('--target-balance <lamports>', 'Target balance for fill-to strategy')
  .option('--create-ata', 'Create missing ATAs', true)
  .option('--use-jito', 'Use Jito bundles', false)
  .option('--tip-strategy <strategy>', 'Jito tip strategy', 'p50')
  .option('--batch-size <n>', 'Transfers per transaction')
  .option('--dry-run', 'Validate without sending', false)
  .option('--output <path>', 'Save distribution report')
  .option('-n, --network <net>', 'Network', 'mainnet')
  .action(async (opts) => {
    renderCommandBanner('bundle-distribute', 'Distribute to multiple wallets');
    try {
      await bundleDistributeCommand({
        sourceKey: opts.sourceKey,
        destinations: opts.destinations,
        token: opts.token,
        strategy: opts.strategy,
        total: opts.total ? parseInt(opts.total, 10) : undefined,
        targetBalance: opts.targetBalance ? parseInt(opts.targetBalance, 10) : undefined,
        createAta: opts.createAta,
        useJito: opts.useJito,
        tipStrategy: opts.tipStrategy,
        batchSize: opts.batchSize ? parseInt(opts.batchSize, 10) : undefined,
        dryRun: opts.dryRun,
        output: opts.output,
        network: opts.network,
      });
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── BUNDLE-PACK ────────────────────────────────────────────
program
  .command('bundle-pack')
  .description('Pack wallets into an encrypted .swbundle file')
  .option('--input <paths...>', 'Wallet JSON files to pack')
  .option('-o, --output <path>', 'Output .swbundle file path')
  .option('--name <name>', 'Bundle name')
  .option('--description <desc>', 'Bundle description')
  .option('-n, --network <net>', 'Network', 'mainnet')
  .action(async (opts) => {
    try {
      await bundlePackCommand({
        input: opts.input,
        output: opts.output,
        name: opts.name,
        description: opts.description,
        network: opts.network,
      });
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── BUNDLE-LIST ────────────────────────────────────────────
program
  .command('bundle-list')
  .description('List wallets in a .swbundle file (no password needed)')
  .option('--file <path>', 'Bundle file path')
  .action(async (opts) => {
    try {
      await bundleListCommand({ file: opts.file });
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── BUNDLE-UNPACK ──────────────────────────────────────────
program
  .command('bundle-unpack')
  .description('Extract wallets from a .swbundle file')
  .option('--file <path>', 'Bundle file path')
  .option('--indices <list>', 'Wallet indices to extract (comma-separated)')
  .option('--labels <list>', 'Extract by label (comma-separated)')
  .option('--tags <list>', 'Extract by tag (comma-separated)')
  .option('--output-dir <path>', 'Directory to save extracted wallets')
  .option('--format <fmt>', 'Output format: json|keypair', 'json')
  .action(async (opts) => {
    try {
      await bundleUnpackCommand({
        file: opts.file,
        indices: opts.indices,
        labels: opts.labels,
        tags: opts.tags,
        outputDir: opts.outputDir,
        format: opts.format,
      });
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── BUNDLE-MERGE ───────────────────────────────────────────
program
  .command('bundle-merge')
  .description('Merge multiple .swbundle files into one')
  .option('--files <paths...>', 'Bundle files to merge')
  .option('-o, --output <path>', 'Output merged bundle file')
  .action(async (opts) => {
    try {
      await bundleMergeCommand({
        files: opts.files,
        output: opts.output,
      });
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// ─── BUNDLE-ADD ─────────────────────────────────────────────
program
  .command('bundle-add')
  .description('Add a wallet to an existing .swbundle file')
  .option('--file <path>', 'Existing bundle file')
  .option('--wallet <path>', 'Wallet JSON file to add')
  .option('--label <label>', 'Label for the wallet')
  .option('--tags <tags>', 'Comma-separated tags')
  .action(async (opts) => {
    try {
      await bundleAddCommand({
        file: opts.file,
        wallet: opts.wallet,
        label: opts.label,
        tags: opts.tags,
      });
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

// Show banner + help if no command provided, then exit before commander duplicates
if (!process.argv.slice(2).length) {
  renderMainBanner();
  program.outputHelp();
  process.exit(0);
}

// Parse and execute
program.parse(process.argv);
