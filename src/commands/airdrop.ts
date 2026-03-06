import * as fs from 'fs';
import chalk from 'chalk';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AirdropOptions, DEFAULT_RPC, WalletFile } from '../types';
import { isValidSolanaAddress, validateAirdropAmount } from '../utils/validation';
import {
  createSpinner,
  displaySuccess,
  displayError,
  displayWarning,
} from '../utils/display';

/**
 * Execute the airdrop command
 */
export async function airdropCommand(options: AirdropOptions): Promise<void> {
  // Validate network
  if (options.network === 'mainnet') {
    throw new Error('Airdrop is not available on mainnet. Use devnet or testnet.');
  }

  // Validate amount
  const amountValidation = validateAirdropAmount(options.amount, options.network);
  if (!amountValidation.valid) {
    throw new Error(amountValidation.error);
  }

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

  const rpcUrl = DEFAULT_RPC[options.network as keyof typeof DEFAULT_RPC];
  const connection = new Connection(rpcUrl, 'confirmed');

  if (addresses.length > 1) {
    displayWarning(
      `Airdropping ${options.amount} SOL to ${addresses.length} addresses on ${options.network}`
    );
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const spinner = createSpinner(
      `Airdropping ${options.amount} SOL to ${address.substring(0, 8)}... (${i + 1}/${addresses.length})`
    );
    spinner.start();

    try {
      const pubkey = new PublicKey(address);
      const lamports = options.amount * LAMPORTS_PER_SOL;

      const signature = await connection.requestAirdrop(pubkey, lamports);

      // Wait for confirmation
      spinner.text = `Confirming transaction ${signature.substring(0, 16)}...`;
      await connection.confirmTransaction(signature, 'confirmed');

      spinner.succeed(
        chalk.green(`Airdropped ${options.amount} SOL to ${address.substring(0, 16)}...`)
      );
      console.log(chalk.gray(`    Signature: ${signature}`));
      successCount++;
    } catch (err) {
      spinner.fail(
        chalk.red(`Failed for ${address.substring(0, 16)}...: ${(err as Error).message}`)
      );
      failCount++;
    }

    // Rate limiting delay between requests
    if (i < addresses.length - 1 && options.delay > 0) {
      await sleep(options.delay);
    }
  }

  // Summary
  console.log();
  if (successCount > 0) {
    displaySuccess(`${successCount} airdrop(s) completed on ${options.network}`);
  }
  if (failCount > 0) {
    displayError(`${failCount} airdrop(s) failed`);
  }
}

/**
 * Load addresses from file
 */
function loadAddressesFromFile(filepath: string): string[] {
  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }

  const raw = fs.readFileSync(filepath, 'utf8');
  const parsed = JSON.parse(raw);

  if (parsed.accounts && Array.isArray(parsed.accounts)) {
    return (parsed as WalletFile).accounts.map((a) => a.address);
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((entry: Record<string, string>) => entry.address)
      .filter((addr: string) => isValidSolanaAddress(addr));
  }

  throw new Error('Unrecognized wallet file format');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
