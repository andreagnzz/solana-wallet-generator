import boxen from 'boxen';
import { theme, fmt, sym } from '../theme';

export interface WalletCardOptions {
  index: number;
  address: string;
  privateKey?: string;
  mnemonic?: string;
  balance?: number;
  derivationPath?: string;
  network: 'mainnet' | 'devnet' | 'testnet';
  showQr?: boolean;
}

export function renderWalletCard(opts: WalletCardOptions): void {
  const networkLabel = fmt.network(opts.network);

  const lines: string[] = [
    `${theme.muted('Account')}  ${theme.bright.bold(`#${opts.index}`)}  ${networkLabel}`,
    theme.muted(sym.dash.repeat(52)),
    '',
    `${theme.secondary('Address')}    ${fmt.addressFull(opts.address)}`,
    `${theme.secondary('Path')}       ${theme.muted(opts.derivationPath ?? "m/44'/501'/0'/0'")}`,
  ];

  if (opts.balance !== undefined) {
    lines.push(`${theme.secondary('Balance')}    ${fmt.sol(opts.balance)}`);
  }

  if (opts.mnemonic) {
    lines.push('');
    lines.push(theme.accent.bold(`  ${sym.warning}  SEED PHRASE \u2014 NEVER SHARE THIS  ${sym.warning}`));
    lines.push(theme.muted(sym.dash.repeat(52)));
    const words = opts.mnemonic.split(' ');
    for (let i = 0; i < words.length; i += 4) {
      const row = words.slice(i, i + 4)
        .map((w, j) => `${theme.muted(`${i + j + 1}.`)} ${theme.bright(w.padEnd(12))}`)
        .join('  ');
      lines.push('  ' + row);
    }
  }

  if (opts.privateKey) {
    lines.push('');
    lines.push(theme.danger.bold('  \uD83D\uDD10 PRIVATE KEY'));
    lines.push(theme.danger(opts.privateKey));
  }

  const box = boxen(lines.join('\n'), {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    borderStyle: 'double',
    borderColor: opts.mnemonic || opts.privateKey ? 'red' : 'cyan',
    title: ' \uD83D\uDD11 WALLET GENERATED ',
    titleAlignment: 'center',
  });

  console.log(box);

  if (opts.showQr) {
    const qrcode = require('qrcode-terminal');
    console.log(theme.secondary('\n  QR Code \u2014 Public Address:'));
    qrcode.generate(opts.address, { small: true });
  }
}
