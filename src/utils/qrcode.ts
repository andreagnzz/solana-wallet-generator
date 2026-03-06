import qrcodeTerminal from 'qrcode-terminal';
import chalk from 'chalk';

/**
 * Display a QR code in the terminal for a Solana address
 *
 * @param address - The Solana public address to encode
 * @param label - Optional label to display above the QR code
 */
export function displayQRCode(address: string, label?: string): void {
  if (label) {
    console.log(chalk.cyan(`\n  ${label}`));
  }
  console.log(chalk.gray(`  Address: ${address}\n`));

  qrcodeTerminal.generate(address, { small: true }, (qr: string) => {
    const lines = qr.split('\n');
    for (const line of lines) {
      console.log('    ' + line);
    }
    console.log();
  });
}

/**
 * Display QR codes for multiple addresses
 *
 * @param addresses - Array of {address, label} pairs
 */
export function displayMultipleQRCodes(
  addresses: Array<{ address: string; label: string }>
): void {
  for (const { address, label } of addresses) {
    displayQRCode(address, label);
  }
}
