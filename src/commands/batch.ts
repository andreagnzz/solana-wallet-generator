import * as fs from 'fs';
import chalk from 'chalk';
import { BatchOptions, BatchWalletEntry, DEFAULT_DERIVATION_PATH } from '../types';
import { generateMnemonic } from '../crypto/entropy';
import { deriveSolanaKeypair, deriveMultipleKeypairs } from '../crypto/derivation';
import { encryptKeystore, promptPasswordWithConfirm } from '../crypto/keystore';
import { exportToCSV, exportToJSONL } from '../utils/csv';
import {
  createSpinner,
  displayFileSaved,
  displayWarning,
  maskSensitive,
} from '../utils/display';
import { validateBatchCount } from '../utils/validation';

/**
 * Execute the batch command
 */
export async function batchCommand(options: BatchOptions): Promise<void> {
  // Validate count
  const validation = validateBatchCount(options.count);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (options.count > 1000) {
    displayWarning(
      `Generating ${options.count} wallets. This may take a while...`
    );
  }

  const timestamp = Date.now();
  const defaultOutput = `wallets_${timestamp}`;
  const outputPath = options.output || `${defaultOutput}.${options.format === 'jsonl' ? 'jsonl' : options.format === 'json' ? 'json' : 'csv'}`;

  const spinner = createSpinner(`Generating ${options.count} wallets...`);
  spinner.start();

  let password: string | undefined;
  if (options.encrypt) {
    spinner.stop();
    password = await promptPasswordWithConfirm();
    spinner.start(`Generating ${options.count} wallets...`);
  }

  const entries: BatchWalletEntry[] = [];
  const createdAt = new Date().toISOString();

  if (options.uniqueSeed) {
    // Each wallet gets its own mnemonic
    for (let i = 0; i < options.count; i++) {
      const mnemonic = generateMnemonic(12);
      const keypair = deriveSolanaKeypair(mnemonic, 0);

      entries.push({
        index: i,
        address: keypair.publicKey,
        privateKey: options.noPrivate ? '' : keypair.privateKey,
        mnemonic: options.noPrivate ? '' : mnemonic,
        derivationPath: keypair.path,
        createdAt,
      });

      if (options.progress && (i + 1) % 100 === 0) {
        spinner.text = chalk.cyan(
          `Generated ${i + 1}/${options.count} wallets...`
        );
      }
    }
  } else {
    // All wallets derived from a single seed
    const mnemonic = generateMnemonic(24);
    const keypairs = deriveMultipleKeypairs(
      mnemonic,
      Math.min(options.count, 100)
    );

    // For counts > 100, we derive in batches using different base paths
    if (options.count <= 100) {
      for (const kp of keypairs) {
        entries.push({
          index: kp.index,
          address: kp.publicKey,
          privateKey: options.noPrivate ? '' : kp.privateKey,
          mnemonic: options.noPrivate ? '' : (kp.index === 0 ? mnemonic : maskSensitive(mnemonic, 8)),
          derivationPath: kp.path,
          createdAt,
        });
      }
    } else {
      // Derive in batches for large counts
      for (let batch = 0; batch < Math.ceil(options.count / 100); batch++) {
        const batchSize = Math.min(100, options.count - batch * 100);
        for (let i = 0; i < batchSize; i++) {
          const globalIndex = batch * 100 + i;
          const kp = deriveSolanaKeypair(
            mnemonic,
            globalIndex,
            undefined,
            DEFAULT_DERIVATION_PATH
          );
          entries.push({
            index: globalIndex,
            address: kp.publicKey,
            privateKey: options.noPrivate ? '' : kp.privateKey,
            mnemonic: options.noPrivate ? '' : (globalIndex === 0 ? mnemonic : ''),
            derivationPath: kp.path,
            createdAt,
          });
        }
        if (options.progress) {
          spinner.text = chalk.cyan(
            `Generated ${Math.min((batch + 1) * 100, options.count)}/${options.count} wallets...`
          );
        }
      }
    }
  }

  // Export based on format
  if (options.format === 'csv') {
    await exportToCSV(entries, outputPath, !options.noPrivate);
  } else if (options.format === 'jsonl') {
    await exportToJSONL(entries, outputPath, !options.noPrivate);
  } else {
    // JSON format
    let outputData: string;
    if (options.encrypt && password) {
      const plaintext = JSON.stringify(entries, null, 2);
      spinner.text = 'Encrypting wallet data...';
      const keystore = await encryptKeystore(plaintext, password);
      outputData = JSON.stringify(keystore, null, 2);
    } else {
      if (options.noPrivate) {
        const safeEntries = entries.map(({ privateKey: _pk, mnemonic: _mn, ...rest }) => rest);
        outputData = JSON.stringify(safeEntries, null, 2);
      } else {
        outputData = JSON.stringify(entries, null, 2);
      }
    }
    fs.writeFileSync(outputPath, outputData, 'utf8');
  }

  spinner.succeed(chalk.green(`Generated ${options.count} wallets`));
  displayFileSaved(outputPath, !!options.encrypt);

  // Summary
  console.log(chalk.gray(`  Format: ${options.format}`));
  console.log(chalk.gray(`  Private keys: ${options.noPrivate ? 'excluded' : 'included'}`));
  console.log(chalk.gray(`  Encrypted: ${options.encrypt ? 'yes' : 'no'}`));
  console.log(chalk.gray(`  Mode: ${options.uniqueSeed ? 'unique seed per wallet' : 'HD from single seed'}`));
  console.log();
}
