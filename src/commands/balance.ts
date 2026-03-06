import * as fs from 'fs';
import chalk from 'chalk';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BalanceOptions, WalletFile, DEFAULT_RPC } from '../types';
import { isValidSolanaAddress, isValidRpcUrl } from '../utils/validation';
import {
  createSpinner,
  displayBalance,
  displayTransaction,
  displayError,
  displayInfo,
} from '../utils/display';

/**
 * Execute the balance command
 */
export async function balanceCommand(options: BalanceOptions): Promise<void> {
  const addresses: string[] = [];

  if (options.address) {
    if (!isValidSolanaAddress(options.address)) {
      throw new Error(`Invalid Solana address: ${options.address}`);
    }
    addresses.push(options.address);
  } else if (options.file) {
    const fileAddresses = loadAddressesFromFile(options.file);
    addresses.push(...fileAddresses);
  } else {
    throw new Error('Provide --address or --file');
  }

  if (addresses.length === 0) {
    throw new Error('No valid addresses found');
  }

  // Determine RPC URL
  let rpcUrl: string;
  if (options.rpc) {
    if (!isValidRpcUrl(options.rpc)) {
      throw new Error(`Invalid RPC URL: ${options.rpc}`);
    }
    rpcUrl = options.rpc;
  } else {
    rpcUrl = DEFAULT_RPC[options.network as keyof typeof DEFAULT_RPC] || DEFAULT_RPC.mainnet;
  }

  const connection = new Connection(rpcUrl, 'confirmed');

  if (options.watch) {
    await watchMode(connection, addresses, options);
  } else {
    await fetchAndDisplay(connection, addresses, options);
  }
}

/**
 * Fetch and display balance information
 */
async function fetchAndDisplay(
  connection: Connection,
  addresses: string[],
  options: BalanceOptions
): Promise<void> {
  const spinner = createSpinner('Fetching balances...');
  spinner.start();

  for (const address of addresses) {
    try {
      const pubkey = new PublicKey(address);
      const balance = await connection.getBalance(pubkey);
      const solBalance = balance / LAMPORTS_PER_SOL;

      spinner.stop();
      displayBalance(address, solBalance, options.network);

      // Token accounts
      if (options.tokens) {
        await displayTokens(connection, pubkey);
      }

      // Transaction history
      if (options.history > 0) {
        await displayHistory(connection, pubkey, options.history);
      }

      spinner.start();
    } catch (err) {
      spinner.stop();
      displayError(`Failed to fetch balance for ${address}: ${(err as Error).message}`);
      spinner.start();
    }
  }

  spinner.stop();
}

/**
 * Display SPL token balances
 */
async function displayTokens(
  connection: Connection,
  pubkey: PublicKey
): Promise<void> {
  const spinner = createSpinner('Fetching tokens...');
  spinner.start();

  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubkey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    spinner.stop();

    if (tokenAccounts.value.length === 0) {
      displayInfo('No SPL tokens found');
      return;
    }

    console.log(chalk.magenta.bold('\n  SPL Tokens\n'));
    console.log(
      chalk.cyan('  Mint'.padEnd(50)) +
      chalk.cyan('Amount'.padEnd(20)) +
      chalk.cyan('Decimals')
    );
    console.log(chalk.gray('  ' + '-'.repeat(78)));

    for (const ta of tokenAccounts.value) {
      const info = ta.account.data.parsed.info;
      const mint = (info.mint as string).padEnd(48);
      const amount = String(info.tokenAmount.uiAmount ?? 0).padEnd(18);
      const decimals = String(info.tokenAmount.decimals);

      console.log(
        chalk.white(`  ${mint}`) +
        chalk.yellow(`  ${amount}`) +
        chalk.gray(`  ${decimals}`)
      );
    }
    console.log();
  } catch {
    spinner.stop();
    displayError('Failed to fetch token accounts');
  }
}

/**
 * Display transaction history
 */
async function displayHistory(
  connection: Connection,
  pubkey: PublicKey,
  limit: number
): Promise<void> {
  const spinner = createSpinner('Fetching transaction history...');
  spinner.start();

  try {
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit });

    spinner.stop();

    if (signatures.length === 0) {
      displayInfo('No recent transactions');
      return;
    }

    console.log(chalk.magenta.bold('\n  Recent Transactions\n'));

    for (const sig of signatures) {
      displayTransaction(sig.signature, sig.blockTime ?? null, sig.slot);
    }
    console.log();
  } catch {
    spinner.stop();
    displayError('Failed to fetch transaction history');
  }
}

/**
 * Watch mode - refresh balances periodically
 */
async function watchMode(
  connection: Connection,
  addresses: string[],
  _options: BalanceOptions
): Promise<void> {
  displayInfo('Watch mode active. Press Ctrl+C to stop.');

  const previousBalances = new Map<string, number>();

  const refresh = async (): Promise<void> => {
    console.clear();
    console.log(chalk.magenta.bold('\n  Balance Watch Mode'));
    console.log(chalk.gray(`  Updated: ${new Date().toLocaleTimeString()}\n`));

    for (const address of addresses) {
      try {
        const pubkey = new PublicKey(address);
        const balance = await connection.getBalance(pubkey);
        const solBalance = balance / LAMPORTS_PER_SOL;

        const prev = previousBalances.get(address);
        let diff = '';
        if (prev !== undefined && prev !== solBalance) {
          const change = solBalance - prev;
          diff = change > 0
            ? chalk.green(` (+${change.toFixed(9)} SOL)`)
            : chalk.red(` (${change.toFixed(9)} SOL)`);
        }

        console.log(
          chalk.cyan('  Address: ') + chalk.green(address) +
          chalk.yellow(` ${solBalance.toFixed(9)} SOL`) + diff
        );

        previousBalances.set(address, solBalance);
      } catch {
        console.log(
          chalk.cyan('  Address: ') + chalk.green(address) +
          chalk.red(' (error fetching balance)')
        );
      }
    }
    console.log(chalk.gray('\n  Refreshing every 10s...'));
  };

  await refresh();
  const interval = setInterval(refresh, 10000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log(chalk.gray('\n  Watch mode stopped.\n'));
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {/* never resolves - runs until SIGINT */});
}

/**
 * Load addresses from a wallet file
 */
function loadAddressesFromFile(filepath: string): string[] {
  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }

  const raw = fs.readFileSync(filepath, 'utf8');
  const parsed = JSON.parse(raw);

  // Try as WalletFile
  if (parsed.accounts && Array.isArray(parsed.accounts)) {
    return (parsed as WalletFile).accounts.map((a) => a.address);
  }

  // Try as array of entries
  if (Array.isArray(parsed)) {
    return parsed
      .map((entry: Record<string, string>) => entry.address)
      .filter((addr: string) => isValidSolanaAddress(addr));
  }

  throw new Error('Unrecognized wallet file format');
}
