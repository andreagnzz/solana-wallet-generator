import boxen from 'boxen';
import { theme, sym, fmt } from '../theme';

export interface SummaryScreenOptions {
  title: string;
  icon?: string;
  stats: Array<{ label: string; value: string }>;
  status: 'success' | 'warning' | 'error';
  footer?: string;
}

export function renderSummaryScreen(opts: SummaryScreenOptions): void {
  const borderColor = opts.status === 'success' ? 'green' :
                      opts.status === 'warning' ? 'yellow' : 'red';

  const statusIcon = opts.status === 'success' ? theme.primary(sym.success) :
                     opts.status === 'warning' ? theme.accent(sym.warning) :
                     theme.danger(sym.error);

  const maxLabelLen = Math.max(...opts.stats.map(s => s.label.length));

  const lines: string[] = [
    `${statusIcon}  ${theme.bright.bold(opts.title)}`,
    fmt.separator(44),
    '',
  ];

  for (const stat of opts.stats) {
    lines.push(
      `${theme.secondary(stat.label.padEnd(maxLabelLen + 2))} ${theme.bright(stat.value)}`
    );
  }

  if (opts.footer) {
    lines.push('');
    lines.push(fmt.separator(44));
    lines.push(theme.muted(opts.footer));
  }

  const box = boxen(lines.join('\n'), {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    borderStyle: 'round',
    borderColor,
    title: opts.icon ? ` ${opts.icon} ` : undefined,
    titleAlignment: 'center',
  });

  console.log();
  console.log(box);
  console.log();
}
