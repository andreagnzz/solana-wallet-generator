import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { DerivedKeypair, WalletFile } from '../types';

/**
 * Create a styled spinner
 */
export function createSpinner(text: string): ReturnType<typeof ora> {
  return ora({
    text,
    spinner: 'dots',
    color: 'cyan',
  });
}

/**
 * Display a generated wallet in a formatted box
 */
export function displayWallet(
  mnemonic: string,
  keypairs: DerivedKeypair[],
  showPrivate: boolean = false
): void {
  const title = chalk.magenta.bold('  SOLANA WALLET GENERATED  ');

  let content = `${title}\n\n`;
  content += chalk.cyan('  Network: ') + chalk.white('Solana') + '\n';
  content += chalk.cyan('  Accounts: ') + chalk.white(keypairs.length.toString()) + '\n\n';

  // Display accounts
  for (const kp of keypairs) {
    content += chalk.cyan(`  Account #${kp.index}`) + '\n';
    content += chalk.gray(`  Path: ${kp.path}`) + '\n';
    content += chalk.green(`  Address: ${kp.publicKey}`) + '\n';

    if (showPrivate) {
      content += chalk.red(`  Private: ${kp.privateKey}`) + '\n';
    }
    content += '\n';
  }

  // Mnemonic section
  content += chalk.yellow.bold('  SEED PHRASE - KEEP THIS PRIVATE') + '\n\n';
  const words = mnemonic.split(' ');
  const wordsPerRow = 6;
  for (let i = 0; i < words.length; i += wordsPerRow) {
    const row = words.slice(i, i + wordsPerRow);
    const numbered = row.map((w, j) =>
      chalk.gray(`${(i + j + 1).toString().padStart(2, ' ')}.`) + chalk.white(` ${w}`)
    );
    content += '  ' + numbered.join('  ') + '\n';
  }

  console.log(
    boxen(content, {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'magenta',
    })
  );
}

/**
 * Display a private key warning
 */
export function displayPrivateKeyWarning(): void {
  console.log(
    boxen(
      chalk.red.bold(
        '  WARNING: Private keys are displayed in plaintext!\n' +
        '  Never share your private keys with anyone.\n' +
        '  Never store them in an insecure location.'
      ),
      {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 2, right: 2 },
        borderStyle: 'double',
        borderColor: 'red',
      }
    )
  );
}

/**
 * Display an account table
 */
export function displayAccountTable(
  keypairs: DerivedKeypair[],
  balances?: Map<string, number>
): void {
  console.log('\n' + chalk.magenta.bold('  Derived Accounts') + '\n');

  const header =
    chalk.cyan('  #'.padEnd(6)) +
    chalk.cyan('Address'.padEnd(48)) +
    chalk.cyan('Path'.padEnd(24)) +
    (balances ? chalk.cyan('Balance') : '');

  console.log(header);
  console.log(chalk.gray('  ' + '-'.repeat(balances ? 90 : 76)));

  for (const kp of keypairs) {
    const idx = chalk.white(`  ${kp.index.toString().padEnd(4)}`);
    const addr = chalk.green(kp.publicKey.padEnd(48));
    const path = chalk.gray(kp.path.padEnd(24));
    const bal = balances
      ? chalk.yellow((balances.get(kp.publicKey) ?? 0).toFixed(4) + ' SOL')
      : '';
    console.log(`${idx}${addr}${path}${bal}`);
  }
  console.log();
}

/**
 * Display a success message
 */
export function displaySuccess(message: string): void {
  console.log(chalk.green(`\n  ✓ ${message}\n`));
}

/**
 * Display an error message
 */
export function displayError(message: string): void {
  console.log(chalk.red(`\n  ✗ ${message}\n`));
}

/**
 * Display an info message
 */
export function displayInfo(message: string): void {
  console.log(chalk.cyan(`\n  ℹ ${message}\n`));
}

/**
 * Display a warning message
 */
export function displayWarning(message: string): void {
  console.log(chalk.yellow(`\n  ⚠ ${message}\n`));
}

/**
 * Display wallet file saved confirmation
 */
export function displayFileSaved(filepath: string, encrypted: boolean): void {
  const icon = encrypted ? '🔒' : '📁';
  const status = encrypted ? 'encrypted' : 'plaintext';
  console.log(
    chalk.green(`\n  ${icon} Wallet saved to ${chalk.white(filepath)} (${status})\n`)
  );
}

/**
 * Display balance information
 */
export function displayBalance(
  address: string,
  balance: number,
  network: string
): void {
  console.log(
    boxen(
      chalk.cyan('  Address: ') + chalk.green(address) + '\n' +
      chalk.cyan('  Balance: ') + chalk.yellow.bold(`${balance.toFixed(9)} SOL`) + '\n' +
      chalk.cyan('  Network: ') + chalk.gray(network),
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
 * Display a transaction history entry
 */
export function displayTransaction(
  signature: string,
  blockTime: number | null,
  slot: number
): void {
  const time = blockTime
    ? new Date(blockTime * 1000).toISOString()
    : 'unknown';
  console.log(
    chalk.gray(`  ${time}`) + '  ' +
    chalk.white(signature.substring(0, 44) + '...') + '  ' +
    chalk.gray(`slot: ${slot}`)
  );
}

/**
 * Format a wallet file summary for display
 */
export function displayWalletFileSummary(wallet: WalletFile): void {
  console.log(
    boxen(
      chalk.magenta.bold('  Wallet File Summary\n\n') +
      chalk.cyan('  Version: ') + chalk.white(wallet.version) + '\n' +
      chalk.cyan('  Network: ') + chalk.white(wallet.network) + '\n' +
      chalk.cyan('  Created: ') + chalk.gray(wallet.createdAt) + '\n' +
      chalk.cyan('  Accounts: ') + chalk.white(wallet.accounts.length.toString()) + '\n' +
      chalk.cyan('  Derivation: ') + chalk.gray(wallet.derivationPath) + '\n' +
      chalk.cyan('  Passphrase: ') + chalk.white(wallet.passphraseUsed ? 'Yes' : 'No'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'magenta',
      }
    )
  );
}

/**
 * Mask sensitive data for safe logging
 */
export function maskSensitive(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '***masked***';
  }
  return data.substring(0, visibleChars) + '...' + data.substring(data.length - visibleChars);
}
