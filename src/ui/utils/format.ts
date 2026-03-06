import { theme, sym } from '../theme';

export function truncateAddress(addr: string, chars: number = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatSolAmount(lamports: number): string {
  return (lamports / 1e9).toFixed(9);
}

export function renderKeyValue(
  key: string,
  value: string,
  keyWidth: number = 16
): string {
  return `${theme.secondary(key.padEnd(keyWidth))} ${theme.bright(value)}`;
}

export function renderStatusLine(
  status: 'success' | 'error' | 'warning' | 'pending' | 'skip',
  address: string,
  detail: string,
  label?: string
): string {
  const icon = status === 'success' ? theme.primary(sym.success) :
               status === 'error'   ? theme.danger(sym.error) :
               status === 'warning' ? theme.accent(sym.warning) :
               status === 'pending' ? theme.accent('\u25D0') :
                                      theme.muted('\u2298');

  const addr = theme.secondary(truncateAddress(address));
  const lbl = label ? theme.muted(` (${label})`) : '';

  return `  ${icon} ${addr}${lbl}  ${detail}`;
}
