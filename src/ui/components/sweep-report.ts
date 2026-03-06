import boxen from 'boxen';
import { theme, fmt, sym } from '../theme';
import { renderStatusLine } from '../utils/format';

export interface SweepReportData {
  walletsProcessed: number;
  walletsSuccess: number;
  walletsSkipped: number;
  walletsErrored: number;
  totalSolGross: number;
  totalFees: number;
  totalRentRecovered: number;
  netSol: number;
  executionTimeMs: number;
  transactions: Array<{
    label?: string;
    address: string;
    amount: number;
    status: 'success' | 'skipped' | 'error';
    signature?: string;
    error?: string;
  }>;
}

export function renderSweepReport(data: SweepReportData): void {
  const isProfit = data.netSol > 0;

  const header = [
    `${theme.secondary('Wallets')}    ` +
    theme.primary(`${sym.success} ${data.walletsSuccess}`) + '  ' +
    theme.muted(`\u2298 ${data.walletsSkipped}`) + '  ' +
    theme.danger(`${sym.error} ${data.walletsErrored}`),
    '',
    `${theme.secondary('SOL Gross')}  ${fmt.sol(data.totalSolGross)}`,
    `${theme.secondary('Fees')}       ${theme.danger('\u2212')} ${fmt.sol(data.totalFees)}`,
    `${theme.secondary('Rent+')}      ${theme.primary('+')} ${fmt.sol(data.totalRentRecovered)}`,
    theme.muted(sym.dash.repeat(44)),
    `${theme.secondary('Net SOL')}    ${
      isProfit
        ? theme.primary.bold(`+ ${fmt.sol(data.netSol)}`)
        : theme.danger.bold(`\u2212 ${fmt.sol(Math.abs(data.netSol))}`)
    }`,
    '',
    `${theme.secondary('Duration')}   ${theme.muted(data.executionTimeMs + 'ms')}`,
  ];

  const box = boxen(header.join('\n'), {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    borderStyle: 'round',
    borderColor: isProfit ? 'green' : 'red',
    title: ' \uD83D\uDD25 SWEEP COMPLETE ',
    titleAlignment: 'center',
  });

  console.log(box);

  if (data.transactions.length > 0) {
    console.log(theme.secondary('\n  Transaction Details:'));
    for (const tx of data.transactions) {
      const amount = tx.status === 'success'
        ? fmt.sol(tx.amount)
        : theme.muted('\u2014');

      const detail = tx.signature
        ? `${amount}  ${fmt.signature(tx.signature)}`
        : tx.error
          ? `${amount}  ${theme.danger(tx.error)}`
          : amount;

      const status = tx.status === 'success' ? 'success' as const :
                     tx.status === 'skipped' ? 'skip' as const : 'error' as const;

      console.log(renderStatusLine(status, tx.address, detail, tx.label));
    }
    console.log();
  }
}
