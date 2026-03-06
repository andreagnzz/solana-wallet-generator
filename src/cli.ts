#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
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

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
