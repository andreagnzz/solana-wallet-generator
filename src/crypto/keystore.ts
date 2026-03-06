import * as crypto from 'crypto';
import argon2 from 'argon2';
import { EncryptedKeystore } from '../types';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const ARGON2_ITERATIONS = 3;
const ARGON2_MEMORY = 65536; // 64 MB
const ARGON2_PARALLELISM = 4;
const KEY_LENGTH = 32;

/**
 * Encrypt data using AES-256-GCM with Argon2id key derivation
 *
 * @param data - Plaintext data to encrypt
 * @param password - Password for key derivation
 * @returns Encrypted keystore object
 */
export async function encryptKeystore(
  data: string,
  password: string
): Promise<EncryptedKeystore> {
  const salt = crypto.randomBytes(32);

  // Derive encryption key using Argon2id
  const key = await argon2.hash(password, {
    type: argon2.argon2id,
    salt,
    timeCost: ARGON2_ITERATIONS,
    memoryCost: ARGON2_MEMORY,
    parallelism: ARGON2_PARALLELISM,
    hashLength: KEY_LENGTH,
    raw: true,
  });

  // Encrypt with AES-256-GCM
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Compute checksum of plaintext for verification
  const checksum = crypto
    .createHash('sha256')
    .update(data, 'utf8')
    .digest('hex');

  // Zero out key buffer
  key.fill(0);

  return {
    version: 1,
    algorithm: ALGORITHM,
    kdf: 'argon2id',
    kdfParams: {
      salt: salt.toString('hex'),
      iterations: ARGON2_ITERATIONS,
      memory: ARGON2_MEMORY,
      parallelism: ARGON2_PARALLELISM,
      keyLen: KEY_LENGTH,
    },
    cipher: {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: encrypted.toString('hex'),
    },
    checksum,
  };
}

/**
 * Decrypt an encrypted keystore
 *
 * @param keystore - Encrypted keystore object
 * @param password - Password for key derivation
 * @returns Decrypted plaintext string
 */
export async function decryptKeystore(
  keystore: EncryptedKeystore,
  password: string
): Promise<string> {
  if (keystore.version !== 1) {
    throw new Error(`Unsupported keystore version: ${keystore.version}`);
  }

  const salt = Buffer.from(keystore.kdfParams.salt, 'hex');

  // Derive key using same Argon2id parameters
  const key = await argon2.hash(password, {
    type: argon2.argon2id,
    salt,
    timeCost: keystore.kdfParams.iterations,
    memoryCost: keystore.kdfParams.memory,
    parallelism: keystore.kdfParams.parallelism,
    hashLength: keystore.kdfParams.keyLen,
    raw: true,
  });

  // Decrypt with AES-256-GCM
  const iv = Buffer.from(keystore.cipher.iv, 'hex');
  const tag = Buffer.from(keystore.cipher.tag, 'hex');
  const encryptedData = Buffer.from(keystore.cipher.data, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted: string;
  try {
    decrypted = decipher.update(encryptedData) + decipher.final('utf8');
  } catch {
    // Zero out key buffer before throwing
    key.fill(0);
    throw new Error('Decryption failed: invalid password or corrupted data');
  }

  // Zero out key buffer
  key.fill(0);

  // Verify checksum
  const checksum = crypto
    .createHash('sha256')
    .update(decrypted, 'utf8')
    .digest('hex');

  if (checksum !== keystore.checksum) {
    throw new Error('Checksum verification failed: data may be corrupted');
  }

  return decrypted;
}

/**
 * Prompt for password securely (masks input)
 */
export async function promptPassword(
  message: string = 'Enter password: '
): Promise<string> {
  const inquirer = await import('inquirer');
  const { password } = await inquirer.default.prompt([
    {
      type: 'password',
      name: 'password',
      message,
      mask: '*',
      validate: (input: string) => {
        if (input.length < 8) {
          return 'Password must be at least 8 characters long';
        }
        return true;
      },
    },
  ]);
  return password;
}

/**
 * Prompt for password with confirmation
 */
export async function promptPasswordWithConfirm(): Promise<string> {
  const password = await promptPassword('Enter encryption password: ');
  const confirm = await promptPassword('Confirm password: ');

  if (password !== confirm) {
    throw new Error('Passwords do not match');
  }

  return password;
}
