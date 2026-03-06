import { theme, fmt, sym } from '../theme';
import { eraseLines } from '../utils/clear';
import { truncateAddress } from '../utils/format';

export interface RotationDashboardState {
  totalBundles: number;
  completedBundles: number;
  landedBundles: number;
  failedBundles: number;
  currentRegion: string;
  currentSigner: string;
  currentTipAccount: string;
  currentTipAmount: number;
  nextDelay: number;
  detectionRiskScore: number;
  throughput: number;
  bundles: Array<{
    index: number;
    region: string;
    signer: string;
    status: 'queued' | 'sending' | 'pending' | 'landed' | 'failed';
    slot?: number;
  }>;
}

export class RotationDashboard {
  private state: RotationDashboardState;
  private lineCount: number = 0;

  constructor(initialState: RotationDashboardState) {
    this.state = initialState;
  }

  update(newState: Partial<RotationDashboardState>): void {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  stop(): void {
    this.lineCount = 0;
  }

  private render(): void {
    if (this.lineCount > 0) {
      eraseLines(this.lineCount);
    }

    const lines: string[] = [];

    lines.push(
      theme.secondary(`  ${sym.diamond} ROTATION DASHBOARD`) +
      theme.muted(` \u00B7 ${this.state.totalBundles} bundles`)
    );
    lines.push(theme.muted('  ' + sym.dash.repeat(70)));

    const progress = Math.round(
      (this.state.completedBundles / Math.max(this.state.totalBundles, 1)) * 100
    );
    const filled = Math.floor(progress / 5);
    const progressBar = '\u2588'.repeat(filled) + '\u2591'.repeat(20 - filled);

    lines.push(
      `  ${theme.primary(progressBar)} ${theme.bright(progress + '%')}` +
      theme.muted(` [${this.state.completedBundles}/${this.state.totalBundles}]`)
    );
    lines.push('');

    lines.push(
      theme.secondary('  Current  ') +
      theme.muted('Region: ') + theme.bright(this.state.currentRegion.padEnd(12)) +
      theme.muted('Signer: ') + theme.secondary(truncateAddress(this.state.currentSigner, 4)) + '  ' +
      theme.muted('Tip: ') + fmt.sol(this.state.currentTipAmount)
    );

    const riskColor =
      this.state.detectionRiskScore < 30 ? theme.primary :
      this.state.detectionRiskScore < 60 ? theme.accent :
                                            theme.danger;

    lines.push(
      theme.secondary('  Risk     ') +
      riskColor(`${this.state.detectionRiskScore}/100`) +
      theme.muted('  Throughput: ') + theme.bright(`${this.state.throughput} tx/min`) +
      theme.muted('  Next delay: ') + theme.muted(`${this.state.nextDelay}ms`)
    );
    lines.push(theme.muted('  ' + sym.dash.repeat(70)));

    const recentBundles = this.state.bundles.slice(-10);
    for (const b of recentBundles) {
      const statusIcon =
        b.status === 'landed'  ? theme.primary(sym.success) :
        b.status === 'failed'  ? theme.danger(sym.error) :
        b.status === 'pending' ? theme.accent('\u25D0') :
        b.status === 'sending' ? theme.secondary(sym.arrow) :
                                  theme.muted('\u00B7');

      const slotInfo = b.slot ? ` ${fmt.slot(b.slot)}` : '';

      lines.push(
        `  ${statusIcon} ${theme.muted(`[${b.index + 1}]`)} ` +
        theme.secondary(b.region.padEnd(12)) +
        theme.secondary(truncateAddress(b.signer, 4)) +
        slotInfo
      );
    }

    if (this.state.completedBundles === this.state.totalBundles && this.state.totalBundles > 0) {
      lines.push(theme.muted('  ' + sym.dash.repeat(70)));
      lines.push(
        `  ${theme.primary(sym.success)} ${theme.bright(this.state.landedBundles + ' landed')}` +
        theme.muted('  /  ') +
        `${theme.danger(sym.error)} ${theme.bright(this.state.failedBundles + ' failed')}`
      );
    }

    lines.push('');

    this.lineCount = lines.length;
    process.stdout.write(lines.join('\n'));
  }
}
