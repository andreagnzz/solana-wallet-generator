import Table from 'cli-table3';
import { theme, fmt } from '../theme';

const TABLE_CHARS = {
  'top': '\u2500', 'top-mid': '\u252C', 'top-left': '\u250C', 'top-right': '\u2510',
  'bottom': '\u2500', 'bottom-mid': '\u2534', 'bottom-left': '\u2514', 'bottom-right': '\u2518',
  'left': '\u2502', 'left-mid': '\u251C', 'mid': '\u2500', 'mid-mid': '\u253C',
  'right': '\u2502', 'right-mid': '\u2524', 'middle': '\u2502',
};

export function createStyledTable(heads: string[]): Table.Table {
  return new Table({
    head: heads.map(h => theme.secondary(h)),
    style: { head: [], border: [] },
    chars: TABLE_CHARS,
  });
}

export function renderWalletTable(
  wallets: Array<{
    index: number;
    address: string;
    balance?: number;
    derivationPath?: string;
  }>
): void {
  const table = createStyledTable(['#', 'Address', 'Balance', 'Path']);

  for (const w of wallets) {
    table.push([
      theme.muted(String(w.index)),
      fmt.address(w.address),
      w.balance !== undefined ? fmt.sol(w.balance) : theme.muted('\u2014'),
      theme.muted(w.derivationPath ?? '\u2014'),
    ]);
  }

  console.log(table.toString());
}

export function renderBundleIndexTable(
  entries: Array<{
    index: number;
    address: string;
    label?: string;
    tags?: string[];
  }>
): void {
  const table = createStyledTable(['#', 'Address', 'Label', 'Tags']);

  for (const e of entries) {
    table.push([
      theme.muted(String(e.index)),
      fmt.address(e.address),
      e.label ? theme.secondary(e.label) : theme.muted('\u2014'),
      e.tags?.length ? theme.muted(e.tags.join(', ')) : theme.muted('\u2014'),
    ]);
  }

  console.log(table.toString());
}
