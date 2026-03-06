import boxen from 'boxen';
import { theme, fmt, sym } from '../theme';
import { renderStatusLine } from '../utils/format';

export interface DistributeReportData {
  strategy: string;
  totalAmount: number;
  totalFees: number;
  recipientCount: number;
  successCount: number;
  failedCount: number;
  executionTimeMs: number;
  token?: string;
  transfers: Array<{
    address: string;
    label?: string;
    amount: number;
    status: 'success' | 'error';
    signature?: string;
    error?: string;
  }>;
}

export function renderDistributeReport(data: DistributeReportData): void {
  const allSuccess = data.failedCount === 0;

  const header = [
    `${theme.secondary('Strategy')}     ${theme.bright(data.strategy.toUpperCase())}`,
    `${theme.secondary('Token')}        ${data.token ? theme.bright(data.token) : theme.primary('SOL')}`,
    `${theme.secondary('Recipients')}   ` +
    theme.primary(`${sym.success} ${data.successCount}`) +
    (data.failedCount > 0 ? `  ${theme.danger(`${sym.error} ${data.failedCount}`)}` : ''),
    '',
    `${theme.secondary('Total Sent')}   ${fmt.sol(data.totalAmount)}`,
    `${theme.secondary('Fees')}         ${theme.danger('\u2212')} ${fmt.sol(data.totalFees)}`,
    theme.muted(sym.dash.repeat(44)),
    `${theme.secondary('Total Cost')}   ${fmt.sol(data.totalAmount + data.totalFees)}`,
    '',
    `${theme.secondary('Duration')}     ${theme.muted(data.executionTimeMs + 'ms')}`,
  ];

  const box = boxen(header.join('\n'), {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    borderStyle: 'round',
    borderColor: allSuccess ? 'green' : 'yellow',
    title: ' \uD83D\uDE80 DISTRIBUTE COMPLETE ',
    titleAlignment: 'center',
  });

  console.log(box);

  if (data.transfers.length > 0) {
    console.log(theme.secondary('\n  Transfer Details:'));
    for (const tx of data.transfers) {
      const detail = tx.signature
        ? `${fmt.sol(tx.amount)}  ${fmt.signature(tx.signature)}`
        : tx.error
          ? `${fmt.sol(tx.amount)}  ${theme.danger(tx.error)}`
          : fmt.sol(tx.amount);

      console.log(renderStatusLine(
        tx.status === 'success' ? 'success' : 'error',
        tx.address,
        detail,
        tx.label
      ));
    }
    console.log();
  }
}
