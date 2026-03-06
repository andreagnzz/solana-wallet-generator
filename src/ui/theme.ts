import chalk from 'chalk';
import gradient from 'gradient-string';

export const theme: {
  primary:   chalk.Chalk;
  secondary: chalk.Chalk;
  accent:    chalk.Chalk;
  danger:    chalk.Chalk;
  muted:     chalk.Chalk;
  bright:    chalk.Chalk;
  dim:       chalk.Chalk;
  titleGradient:   (text: string) => string;
  dangerGradient:  (text: string) => string;
  solanaGradient:  (text: string) => string;
  bgDanger:  chalk.Chalk;
  bgSuccess: chalk.Chalk;
  bgWarning: chalk.Chalk;
} = {
  primary:   chalk.hex('#00FF9C'),
  secondary: chalk.hex('#00D4FF'),
  accent:    chalk.hex('#FF6B35'),
  danger:    chalk.hex('#FF2D55'),
  muted:     chalk.hex('#4A4A6A'),
  bright:    chalk.hex('#FFFFFF'),
  dim:       chalk.hex('#2A2A3A'),

  titleGradient:   gradient(['#00FF9C', '#00D4FF']),
  dangerGradient:  gradient(['#FF2D55', '#FF6B35']),
  solanaGradient:  gradient(['#9945FF', '#14F195']),

  bgDanger:  chalk.bgHex('#FF2D55').hex('#000000'),
  bgSuccess: chalk.bgHex('#00FF9C').hex('#000000'),
  bgWarning: chalk.bgHex('#FF6B35').hex('#000000'),
};

export const sym = {
  success: '\u2713',
  error:   '\u2717',
  warning: '\u26A0',
  info:    '\u25C6',
  arrow:   '\u2192',
  bullet:  '\u25B8',
  diamond: '\u25C8',
  block:   '\u2588',
  dash:    '\u2500',
  pipe:    '\u2502',
  dot:     '\u25CF',
};

export const fmt = {
  sol: (lamports: number) =>
    theme.primary.bold(`\u25CE ${(lamports / 1e9).toFixed(9)} SOL`),

  lamports: (n: number) =>
    theme.muted(`(${n.toLocaleString()} lamports)`),

  address: (addr: string) =>
    theme.secondary(`${addr.slice(0, 4)}...${addr.slice(-4)}`),

  addressFull: (addr: string) =>
    theme.secondary(addr),

  signature: (sig: string) =>
    theme.muted(`${sig.slice(0, 8)}...${sig.slice(-8)}`),

  slot: (n: number) =>
    theme.muted.italic(`slot #${n.toLocaleString()}`),

  timestamp: () =>
    theme.dim(new Date().toISOString()),

  label: (text: string) =>
    theme.secondary.bold(text),

  value: (text: string) =>
    theme.bright(text),

  redacted: () =>
    theme.danger('\u2588'.repeat(20) + ' [REDACTED]'),

  percent: (n: number) =>
    n >= 80 ? theme.primary(`${n}%`) :
    n >= 50 ? theme.accent(`${n}%`) :
              theme.danger(`${n}%`),

  network: (net: string) =>
    net === 'mainnet' ? theme.danger(`${sym.dot} MAINNET`) :
    net === 'devnet'  ? theme.primary(`${sym.dot} DEVNET`) :
                        theme.accent(`${sym.dot} ${net.toUpperCase()}`),

  separator: (width: number = 60) =>
    theme.muted(sym.dash.repeat(width)),
};
