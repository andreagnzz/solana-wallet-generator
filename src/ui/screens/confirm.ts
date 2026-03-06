import boxen from 'boxen';
import { theme, sym } from '../theme';

export interface ConfirmScreenOptions {
  title: string;
  message: string;
  details?: string[];
  type: 'danger' | 'warning' | 'info';
}

export function renderConfirmScreen(opts: ConfirmScreenOptions): void {
  const borderColor = opts.type === 'danger' ? 'red' :
                      opts.type === 'warning' ? 'yellow' : 'cyan';

  const icon = opts.type === 'danger' ? sym.warning :
               opts.type === 'warning' ? sym.warning : sym.info;

  const colorFn = opts.type === 'danger' ? theme.danger :
                  opts.type === 'warning' ? theme.accent : theme.secondary;

  const lines: string[] = [
    colorFn.bold(`${icon}  ${opts.title}`),
    '',
    theme.bright(opts.message),
  ];

  if (opts.details && opts.details.length > 0) {
    lines.push('');
    for (const detail of opts.details) {
      lines.push(theme.muted(`  ${sym.bullet} ${detail}`));
    }
  }

  lines.push('');
  lines.push(
    opts.type === 'danger'
      ? theme.danger('This action cannot be undone.')
      : theme.muted('Please confirm to continue.')
  );

  const box = boxen(lines.join('\n'), {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    borderStyle: 'round',
    borderColor,
    title: ` ${icon} CONFIRMATION REQUIRED `,
    titleAlignment: 'center',
  });

  console.log();
  console.log(box);
  console.log();
}
