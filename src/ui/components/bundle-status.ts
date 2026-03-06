import { createSpinner } from 'nanospinner';
import { theme, fmt, sym } from '../theme';

export interface BundleStatusOptions {
  bundleId: string;
  batchIndex: number;
  totalBatches: number;
  region: string;
  tipLamports: number;
  tipAccount: string;
  status: 'sending' | 'pending' | 'landed' | 'failed';
  slot?: number;
  error?: string;
}

export function createBundleStatusDisplay(opts: BundleStatusOptions) {
  const prefix = theme.muted(`[${opts.batchIndex + 1}/${opts.totalBatches}]`);
  const region = theme.secondary(opts.region.toUpperCase());
  const tip = fmt.sol(opts.tipLamports);

  const spinner = createSpinner(
    `${prefix} Bundle ${theme.muted(opts.bundleId.slice(0, 12) + '...')} ${sym.arrow} ${region} ${tip}`
  );

  return {
    start: () => spinner.start({ text: `${prefix} Sending to ${region}...` }),

    update: (status: BundleStatusOptions['status'], slot?: number) => {
      if (status === 'pending') {
        spinner.update({ text: `${prefix} Pending confirmation... ${theme.muted(opts.region)}` });
      } else if (status === 'landed' && slot) {
        spinner.success({
          text: `${prefix} ${theme.primary(`${sym.success} LANDED`)} ${fmt.slot(slot)} ${region} ${tip}`,
        });
      } else if (status === 'failed') {
        spinner.error({
          text: `${prefix} ${theme.danger(`${sym.error} FAILED`)} ${theme.muted(opts.error ?? 'Unknown error')}`,
        });
      }
    },

    stop: () => spinner.stop(),
  };
}

export function renderBatchDashboard(
  batches: BundleStatusOptions[],
  report?: { landed: number; failed: number; totalFees: number }
): void {
  console.log();
  console.log(
    theme.secondary(`  ${sym.diamond} BATCH EXECUTION`) +
    theme.muted(` \u00B7 ${batches.length} bundles`)
  );
  console.log(theme.muted('  ' + sym.dash.repeat(70)));

  for (const b of batches) {
    const statusIcon =
      b.status === 'landed'  ? theme.primary(sym.success) :
      b.status === 'failed'  ? theme.danger(sym.error) :
      b.status === 'pending' ? theme.accent('\u25D0') :
                               theme.muted('\u2026');

    const statusText =
      b.status === 'landed'  ? theme.primary(`LANDED ${fmt.slot(b.slot!)}`) :
      b.status === 'failed'  ? theme.danger(`FAILED \u00B7 ${b.error}`) :
      b.status === 'pending' ? theme.accent('PENDING') :
                               theme.muted('SENDING');

    console.log(
      `  ${statusIcon} ` +
      theme.muted(`[${b.batchIndex + 1}]`) + ' ' +
      theme.secondary(b.region.padEnd(12)) +
      fmt.sol(b.tipLamports) + '  ' +
      statusText
    );
  }

  if (report) {
    console.log(theme.muted('  ' + sym.dash.repeat(70)));
    console.log(
      `  ${theme.primary(`${sym.success} ${report.landed} landed`)}` +
      theme.muted('  /  ') +
      `${theme.danger(`${sym.error} ${report.failed} failed`)}` +
      theme.muted('  /  ') +
      `Fees: ${fmt.sol(report.totalFees)}`
    );
    console.log();
  }
}
