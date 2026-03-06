import * as fs from 'fs';
import chalk from 'chalk';
import { Keypair, PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SignOptions, WalletFile, EncryptedKeystore } from '../types';
import { keypairFromPrivateKey } from '../crypto/derivation';
import { decryptKeystore, promptPassword } from '../crypto/keystore';
import { isValidPrivateKey, isValidSolanaAddress } from '../utils/validation';
import {
  createSpinner,
  displaySuccess,
  displayError,
} from '../utils/display';
import boxen from 'boxen';

/**
 * Execute the sign command
 */
export async function signCommand(options: SignOptions): Promise<void> {
  if (options.verify) {
    await verifySignature(options);
    return;
  }

  await signMessage(options);
}

/**
 * Sign a message with a private key
 */
async function signMessage(options: SignOptions): Promise<void> {
  if (!options.message) {
    throw new Error('--message is required for signing');
  }

  const keypair = await resolveKeypair(options);

  const spinner = createSpinner('Signing message...');
  spinner.start();

  const messageBytes = Buffer.from(options.message, 'utf8');
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase58 = bs58.encode(Buffer.from(signature));

  spinner.succeed(chalk.green('Message signed'));

  console.log(
    boxen(
      chalk.magenta.bold('  Message Signature\n\n') +
      chalk.cyan('  Address:   ') + chalk.green(keypair.publicKey.toBase58()) + '\n' +
      chalk.cyan('  Message:   ') + chalk.white(options.message) + '\n' +
      chalk.cyan('  Signature: ') + chalk.yellow(signatureBase58),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      }
    )
  );
}

/**
 * Verify a message signature
 */
async function verifySignature(options: SignOptions): Promise<void> {
  if (!options.message) {
    throw new Error('--message is required for verification');
  }
  if (!options.signature) {
    throw new Error('--signature is required for verification');
  }
  if (!options.address) {
    throw new Error('--address is required for verification');
  }

  if (!isValidSolanaAddress(options.address)) {
    throw new Error(`Invalid Solana address: ${options.address}`);
  }

  const spinner = createSpinner('Verifying signature...');
  spinner.start();

  try {
    const messageBytes = Buffer.from(options.message, 'utf8');
    const signatureBytes = bs58.decode(options.signature);
    const publicKey = new PublicKey(options.address);

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      Uint8Array.from(signatureBytes),
      publicKey.toBytes()
    );

    spinner.stop();

    if (isValid) {
      displaySuccess('Signature is VALID');
      console.log(
        boxen(
          chalk.green.bold('  VALID SIGNATURE\n\n') +
          chalk.cyan('  Address:   ') + chalk.green(options.address) + '\n' +
          chalk.cyan('  Message:   ') + chalk.white(options.message) + '\n' +
          chalk.cyan('  Signature: ') + chalk.yellow(options.signature),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
          }
        )
      );
    } else {
      displayError('Signature is INVALID');
    }
  } catch (err) {
    spinner.fail('Verification failed');
    throw new Error(`Verification error: ${(err as Error).message}`);
  }
}

/**
 * Resolve a Keypair from the provided options
 */
async function resolveKeypair(options: SignOptions): Promise<Keypair> {
  if (options.privateKey) {
    if (!isValidPrivateKey(options.privateKey)) {
      throw new Error('Invalid private key format');
    }
    return keypairFromPrivateKey(options.privateKey);
  }

  if (options.file) {
    return loadKeypairFromFile(options.file);
  }

  throw new Error('Provide --private-key or --file');
}

/**
 * Load a keypair from a wallet file
 */
async function loadKeypairFromFile(filepath: string): Promise<Keypair> {
  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }

  const raw = fs.readFileSync(filepath, 'utf8');
  const parsed = JSON.parse(raw);

  // Check if encrypted
  if ('algorithm' in parsed && parsed['algorithm'] === 'aes-256-gcm') {
    const password = await promptPassword('Enter decryption password: ');
    const decrypted = await decryptKeystore(parsed as EncryptedKeystore, password);
    const wallet = JSON.parse(decrypted) as WalletFile;

    if (!wallet.accounts || wallet.accounts.length === 0) {
      throw new Error('No accounts found in wallet file');
    }

    const pk = wallet.accounts[0].privateKey;
    if (pk.startsWith('***')) {
      throw new Error('Private key is hidden in this wallet file. Use --show-private when generating.');
    }
    return keypairFromPrivateKey(pk);
  }

  // Plaintext wallet
  const wallet = parsed as WalletFile;
  if (!wallet.accounts || wallet.accounts.length === 0) {
    throw new Error('No accounts found in wallet file');
  }

  const pk = wallet.accounts[0].privateKey;
  if (pk.startsWith('***')) {
    throw new Error('Private key is hidden in this wallet file. Use --show-private when generating.');
  }
  return keypairFromPrivateKey(pk);
}
