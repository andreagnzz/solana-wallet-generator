import * as fs from 'fs';
import chalk from 'chalk';
import { GenerateOptions, WalletFile, WalletAccount, DEFAULT_DERIVATION_PATH } from '../types';
import { generateMnemonic } from '../crypto/entropy';
import { deriveMultipleKeypairs } from '../crypto/derivation';
import { encryptKeystore, promptPasswordWithConfirm } from '../crypto/keystore';
import {
  displayWallet,
  displayPrivateKeyWarning,
  displayFileSaved,
  displayWarning,
  createSpinner,
  maskSensitive,
} from '../utils/display';
import { displayQRCode } from '../utils/qrcode';
import { exportToCSV, exportToJSONL } from '../utils/csv';
import { validateWordCount, validateAccountCount } from '../utils/validation';

/**
 * Execute the generate command
 */
export async function generateCommand(options: GenerateOptions): Promise<void> {
  // Validate inputs
  if (!validateWordCount(options.words)) {
    throw new Error(`Invalid word count: ${options.words}. Must be 12, 15, 18, 21, or 24.`);
  }

  const accountValidation = validateAccountCount(options.accounts);
  if (!accountValidation.valid) {
    throw new Error(accountValidation.error);
  }

  const spinner = createSpinner('Generating wallet...');
  spinner.start();

  // Generate mnemonic
  const mnemonic = generateMnemonic(options.words, options.language);

  // Derive keypairs
  const derivationPath = options.derivation || DEFAULT_DERIVATION_PATH;
  const keypairs = deriveMultipleKeypairs(
    mnemonic,
    options.accounts,
    options.passphrase,
    derivationPath
  );

  spinner.succeed(chalk.green('Wallet generated successfully'));

  // Show private key warning if requested
  if (options.showPrivate) {
    displayPrivateKeyWarning();
  }

  // Display wallet
  displayWallet(mnemonic, keypairs, options.showPrivate);

  // Display QR codes if requested
  if (options.qr) {
    for (const kp of keypairs) {
      displayQRCode(kp.publicKey, `Account #${kp.index}`);
    }
  }

  // Save to file if requested
  if (options.output) {
    await saveWalletFile(
      options.output,
      mnemonic,
      keypairs,
      options,
      derivationPath
    );
  }

  // Security reminder
  displayWarning(
    'Store your seed phrase in a safe place. ' +
    'Anyone with access to it can control your funds.'
  );
}

/**
 * Save wallet data to file
 */
async function saveWalletFile(
  filepath: string,
  mnemonic: string,
  keypairs: ReturnType<typeof deriveMultipleKeypairs>,
  options: GenerateOptions,
  derivationPath: string
): Promise<void> {
  const spinner = createSpinner('Saving wallet file...');
  spinner.start();

  const accounts: WalletAccount[] = keypairs.map((kp) => ({
    index: kp.index,
    address: kp.publicKey,
    privateKey: options.showPrivate ? kp.privateKey : '***hidden***',
    path: kp.path,
  }));

  const walletData: WalletFile = {
    version: '1.0.0',
    network: options.network,
    createdAt: new Date().toISOString(),
    mnemonic: mnemonic,
    passphraseUsed: !!options.passphrase,
    derivationPath,
    accounts,
  };

  if (options.format === 'csv') {
    const entries = keypairs.map((kp) => ({
      index: kp.index,
      address: kp.publicKey,
      privateKey: options.showPrivate ? kp.privateKey : '***hidden***',
      mnemonic: maskSensitive(mnemonic, 8),
      derivationPath: kp.path,
      createdAt: walletData.createdAt,
    }));
    await exportToCSV(entries, filepath, options.showPrivate);
    spinner.succeed('Wallet saved');
    displayFileSaved(filepath, false);
    return;
  }

  if (options.format === 'jsonl') {
    const entries = keypairs.map((kp) => ({
      index: kp.index,
      address: kp.publicKey,
      privateKey: options.showPrivate ? kp.privateKey : '***hidden***',
      mnemonic: maskSensitive(mnemonic, 8),
      derivationPath: kp.path,
      createdAt: walletData.createdAt,
    }));
    await exportToJSONL(entries, filepath, options.showPrivate);
    spinner.succeed('Wallet saved');
    displayFileSaved(filepath, false);
    return;
  }

  // JSON format (default)
  let outputData: string;
  let encrypted = false;

  if (options.encrypt) {
    spinner.stop();
    const password = await promptPasswordWithConfirm();
    spinner.start('Encrypting wallet data...');

    const plaintext = JSON.stringify(walletData, null, 2);
    const keystore = await encryptKeystore(plaintext, password);
    outputData = JSON.stringify(keystore, null, 2);
    encrypted = true;
  } else {
    // In plaintext mode, still hide private keys unless --show-private
    if (!options.showPrivate) {
      walletData.accounts = walletData.accounts.map((a) => ({
        ...a,
        privateKey: '***hidden***',
      }));
      walletData.mnemonic = '***hidden - use --show-private to include***';
    }
    outputData = JSON.stringify(walletData, null, 2);
  }

  fs.writeFileSync(filepath, outputData, 'utf8');
  spinner.succeed('Wallet saved');
  displayFileSaved(filepath, encrypted);
}
