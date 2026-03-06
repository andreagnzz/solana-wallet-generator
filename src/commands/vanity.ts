import { Keypair } from '@solana/web3.js';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as os from 'os';
import * as fs from 'fs';
import chalk from 'chalk';
import bs58 from 'bs58';
import { VanityOptions, VanityResult } from '../types';
import {
  createSpinner,
  displaySuccess,
  displayWarning,
  displayFileSaved,
} from '../utils/display';
import { isValidBase58Pattern } from '../utils/validation';
import boxen from 'boxen';

/**
 * Vanity worker function - runs in worker threads
 */
function vanityWorker(): void {
  if (!parentPort || !workerData) return;

  const { prefix, suffix, contains, caseSensitive } = workerData as {
    prefix?: string;
    suffix?: string;
    contains?: string;
    caseSensitive: boolean;
  };

  let attempts = 0;

  while (true) {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    attempts++;

    const testAddress = caseSensitive ? address : address.toLowerCase();
    const testPrefix = prefix ? (caseSensitive ? prefix : prefix.toLowerCase()) : undefined;
    const testSuffix = suffix ? (caseSensitive ? suffix : suffix.toLowerCase()) : undefined;
    const testContains = contains ? (caseSensitive ? contains : contains.toLowerCase()) : undefined;

    let match = true;

    if (testPrefix && !testAddress.startsWith(testPrefix)) match = false;
    if (testSuffix && !testAddress.endsWith(testSuffix)) match = false;
    if (testContains && !testAddress.includes(testContains)) match = false;

    if (match) {
      parentPort!.postMessage({
        type: 'found',
        address,
        privateKey: bs58.encode(Buffer.from(keypair.secretKey)),
        attempts,
      });
      return;
    }

    // Report progress every 10000 attempts
    if (attempts % 10000 === 0) {
      parentPort!.postMessage({ type: 'progress', attempts });
    }
  }
}

// If this file is loaded as a worker, run the worker function
if (!isMainThread) {
  vanityWorker();
}

/**
 * Estimate the expected number of attempts for a vanity pattern
 */
function estimateAttempts(pattern: string, caseSensitive: boolean): number {
  const base58Chars = 58;
  const len = pattern.length;
  if (caseSensitive) {
    return Math.pow(base58Chars, len);
  }
  // Case-insensitive: effective alphabet is smaller
  return Math.pow(base58Chars / 2, len);
}

/**
 * Execute the vanity command
 */
export async function vanityCommand(options: VanityOptions): Promise<void> {
  // Validate pattern
  const pattern = options.prefix || options.suffix || options.contains || '';
  if (!pattern) {
    throw new Error('At least one of --prefix, --suffix, or --contains is required');
  }

  if (!isValidBase58Pattern(pattern)) {
    throw new Error(
      'Pattern contains invalid Base58 characters. ' +
      'Valid characters: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    );
  }

  // Warn about long patterns
  if (pattern.length > 5) {
    displayWarning(
      `Pattern "${pattern}" has ${pattern.length} characters. ` +
      'This may take a very long time (hours or days).'
    );
  }

  const estimated = estimateAttempts(pattern, options.caseSensitive);
  console.log(
    chalk.cyan(`\n  Estimated attempts: ~${estimated.toLocaleString()}\n`)
  );

  const threadCount = Math.min(
    options.threads || Math.max(1, os.cpus().length - 1),
    os.cpus().length
  );

  console.log(chalk.gray(`  Using ${threadCount} worker threads\n`));

  const spinner = createSpinner('Searching for vanity address...');
  spinner.start();

  const startTime = Date.now();
  let totalAttempts = 0;

  const result = await new Promise<VanityResult>((resolve, reject) => {
    const workers: Worker[] = [];
    let found = false;

    for (let i = 0; i < threadCount; i++) {
      const worker = new Worker(__filename, {
        workerData: {
          prefix: options.prefix,
          suffix: options.suffix,
          contains: options.contains,
          caseSensitive: options.caseSensitive,
        },
      });

      workers.push(worker);

      worker.on('message', (msg: { type: string; address?: string; privateKey?: string; attempts: number }) => {
        if (msg.type === 'progress') {
          totalAttempts += msg.attempts;
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = Math.round(totalAttempts / elapsed);
          spinner.text = chalk.cyan(
            `Searching... ${totalAttempts.toLocaleString()} attempts (${rate.toLocaleString()}/s)`
          );
        } else if (msg.type === 'found' && !found) {
          found = true;
          totalAttempts += msg.attempts;
          const duration = Date.now() - startTime;

          // Terminate all workers
          for (const w of workers) {
            w.terminate().catch(() => {/* ignore */});
          }

          resolve({
            address: msg.address!,
            privateKey: msg.privateKey!,
            attempts: totalAttempts,
            duration,
          });
        }
      });

      worker.on('error', (err) => {
        if (!found) {
          found = true;
          for (const w of workers) {
            w.terminate().catch(() => {/* ignore */});
          }
          reject(err);
        }
      });
    }
  });

  spinner.succeed(chalk.green('Vanity address found!'));

  // Display result
  const durationSec = (result.duration / 1000).toFixed(2);
  console.log(
    boxen(
      chalk.magenta.bold('  VANITY ADDRESS FOUND\n\n') +
      chalk.cyan('  Address:  ') + chalk.green.bold(result.address) + '\n' +
      chalk.cyan('  Attempts: ') + chalk.white(result.attempts.toLocaleString()) + '\n' +
      chalk.cyan('  Duration: ') + chalk.white(`${durationSec}s`) + '\n' +
      chalk.cyan('  Rate:     ') + chalk.white(
        Math.round(result.attempts / (result.duration / 1000)).toLocaleString() + '/s'
      ),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'green',
      }
    )
  );

  // Save if requested
  if (options.save) {
    const data = JSON.stringify(
      {
        address: result.address,
        privateKey: result.privateKey,
        pattern: { prefix: options.prefix, suffix: options.suffix, contains: options.contains },
        attempts: result.attempts,
        duration: result.duration,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    );
    fs.writeFileSync(options.save, data, 'utf8');
    displayFileSaved(options.save, false);
  }

  displaySuccess(
    'Remember to save your private key securely!'
  );
}
