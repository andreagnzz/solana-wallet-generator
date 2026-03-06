import * as fs from 'fs';
import chalk from 'chalk';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { InspectOptions, WalletFile, EncryptedKeystore, DEFAULT_RPC, DerivedKeypair } from '../types';
import { deriveMultipleKeypairs, keypairFromPrivateKey } from '../crypto/derivation';
import { decryptKeystore, promptPassword } from '../crypto/keystore';
import { validateMnemonicInput, isValidPrivateKey, isValidSolanaAddress } from '../utils/validation';
import {
  createSpinner,
  displayAccountTable,
  displayWalletFileSummary,
  displayError,
  displayInfo,
  displayWarning,
} from '../utils/display';

/**
 * Execute the inspect command
 */
export async function inspectCommand(options: InspectOptions): Promise<void> {
  let mnemonic: string | undefined;
  let keypairs: DerivedKeypair[] = [];

  if (options.file) {
    // Load from file
    const result = await loadWalletFile(options.file, options.decrypt);
    if (result.walletData) {
      displayWalletFileSummary(result.walletData);
      mnemonic = result.walletData.mnemonic;
      if (mnemonic && !mnemonic.startsWith('***')) {
        keypairs = deriveMultipleKeypairs(mnemonic, options.accounts);
      } else {
        // If mnemonic is hidden, show accounts from file
        keypairs = result.walletData.accounts.map((a) => ({
          publicKey: a.address,
          privateKey: a.privateKey,
          privateKeySeed: '',
          path: a.path,
          index: a.index,
        }));
      }
    }
  } else if (options.mnemonic) {
    // Derive from mnemonic
    const validation = validateMnemonicInput(options.mnemonic);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    displayInfo(`Valid BIP39 mnemonic (${validation.wordCount} words)`);
    mnemonic = options.mnemonic;
    keypairs = deriveMultipleKeypairs(mnemonic, options.accounts);
  } else if (options.privateKey) {
    // Inspect single private key
    if (!isValidPrivateKey(options.privateKey)) {
      throw new Error('Invalid private key format');
    }
    const kp = keypairFromPrivateKey(options.privateKey);
    keypairs = [{
      publicKey: kp.publicKey.toBase58(),
      privateKey: options.privateKey,
      privateKeySeed: '',
      path: 'N/A (imported)',
      index: 0,
    }];
  } else {
    throw new Error('Provide --file, --mnemonic, or --private-key');
  }

  if (keypairs.length === 0) {
    displayError('No accounts found');
    return;
  }

  // Show wallet compatibility
  if (mnemonic) {
    console.log(chalk.magenta.bold('\n  Wallet Compatibility'));
    console.log(chalk.green('  ✓ Phantom'));
    console.log(chalk.green('  ✓ Solflare'));
    console.log(chalk.green('  ✓ Backpack'));
    console.log(chalk.yellow('  ~ Ledger (verify derivation path)'));
    console.log();
  }

  // Show balances if requested
  let balances: Map<string, number> | undefined;
  if (options.showBalance) {
    balances = await fetchBalances(keypairs, options.network);
  }

  displayAccountTable(keypairs, balances);

  // Show token accounts if requested
  if (options.showTokens) {
    await displayTokenAccounts(keypairs, options.network);
  }
}

/**
 * Load and parse a wallet file
 */
async function loadWalletFile(
  filepath: string,
  decrypt: boolean
): Promise<{ walletData: WalletFile | null }> {
  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }

  const spinner = createSpinner('Loading wallet file...');
  spinner.start();

  const raw = fs.readFileSync(filepath, 'utf8');
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(raw);
  } catch {
    spinner.fail('Invalid JSON file');
    throw new Error('Failed to parse wallet file as JSON');
  }

  // Check if it's an encrypted keystore
  if ('algorithm' in parsed && parsed['algorithm'] === 'aes-256-gcm') {
    if (!decrypt) {
      spinner.fail('File is encrypted');
      displayWarning('Use --decrypt flag to decrypt the file');
      return { walletData: null };
    }

    spinner.stop();
    const password = await promptPassword('Enter decryption password: ');
    spinner.start('Decrypting...');

    try {
      const decrypted = await decryptKeystore(parsed as unknown as EncryptedKeystore, password);
      const walletData = JSON.parse(decrypted) as WalletFile;
      spinner.succeed('Wallet file decrypted');
      return { walletData };
    } catch (err) {
      spinner.fail('Decryption failed');
      throw err;
    }
  }

  // Plaintext wallet file
  spinner.succeed('Wallet file loaded');
  return { walletData: parsed as unknown as WalletFile };
}

/**
 * Fetch SOL balances for all keypairs
 */
async function fetchBalances(
  keypairs: DerivedKeypair[],
  network: string
): Promise<Map<string, number>> {
  const spinner = createSpinner('Fetching balances...');
  spinner.start();

  const rpcUrl = DEFAULT_RPC[network as keyof typeof DEFAULT_RPC] || DEFAULT_RPC.mainnet;
  const connection = new Connection(rpcUrl, 'confirmed');
  const balances = new Map<string, number>();

  for (const kp of keypairs) {
    try {
      if (!isValidSolanaAddress(kp.publicKey)) continue;
      const pubkey = new PublicKey(kp.publicKey);
      const balance = await connection.getBalance(pubkey);
      balances.set(kp.publicKey, balance / LAMPORTS_PER_SOL);
    } catch {
      balances.set(kp.publicKey, 0);
    }
  }

  spinner.succeed('Balances fetched');
  return balances;
}

/**
 * Display SPL token accounts
 */
async function displayTokenAccounts(
  keypairs: DerivedKeypair[],
  network: string
): Promise<void> {
  const spinner = createSpinner('Fetching token accounts...');
  spinner.start();

  const rpcUrl = DEFAULT_RPC[network as keyof typeof DEFAULT_RPC] || DEFAULT_RPC.mainnet;
  const connection = new Connection(rpcUrl, 'confirmed');

  for (const kp of keypairs) {
    try {
      if (!isValidSolanaAddress(kp.publicKey)) continue;
      const pubkey = new PublicKey(kp.publicKey);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        pubkey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      if (tokenAccounts.value.length > 0) {
        console.log(chalk.cyan(`\n  Token accounts for Account #${kp.index}:`));
        for (const ta of tokenAccounts.value) {
          const info = ta.account.data.parsed.info;
          const mint = info.mint as string;
          const amount = info.tokenAmount.uiAmount as number;
          const decimals = info.tokenAmount.decimals as number;
          console.log(
            chalk.gray(`    Mint: ${mint}`) + '  ' +
            chalk.yellow(`Amount: ${amount} (${decimals} decimals)`)
          );
        }
      }
    } catch {
      // Skip on error
    }
  }

  spinner.succeed('Token accounts fetched');
}
