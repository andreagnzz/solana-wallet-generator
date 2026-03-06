import { theme } from '../theme';

export function renderFrame(
  content: string,
  options: { title?: string; width?: number; borderColor?: 'cyan' | 'red' | 'green' | 'yellow' } = {}
): string {
  const width = options.width ?? 60;
  const color = options.borderColor === 'red' ? theme.danger :
                options.borderColor === 'green' ? theme.primary :
                options.borderColor === 'yellow' ? theme.accent :
                theme.secondary;

  const top = color(`\u250C${options.title
    ? `\u2500 ${options.title} ${''.padEnd(width - options.title.length - 4, '\u2500')}`
    : '\u2500'.repeat(width - 2)}\u2510`);

  const bottom = color(`\u2514${'\u2500'.repeat(width - 2)}\u2518`);

  const lines = content.split('\n').map(line =>
    color('\u2502') + ' ' + line.padEnd(width - 4) + ' ' + color('\u2502')
  );

  return [top, ...lines, bottom].join('\n');
}

export function renderDoubleFrame(
  content: string,
  options: { title?: string; width?: number; borderColor?: 'cyan' | 'red' | 'green' | 'yellow' } = {}
): string {
  const width = options.width ?? 60;
  const color = options.borderColor === 'red' ? theme.danger :
                options.borderColor === 'green' ? theme.primary :
                options.borderColor === 'yellow' ? theme.accent :
                theme.secondary;

  const top = color(`\u2554${options.title
    ? `\u2550 ${options.title} ${''.padEnd(width - options.title.length - 4, '\u2550')}`
    : '\u2550'.repeat(width - 2)}\u2557`);

  const bottom = color(`\u255A${'\u2550'.repeat(width - 2)}\u255D`);

  const lines = content.split('\n').map(line =>
    color('\u2551') + ' ' + line.padEnd(width - 4) + ' ' + color('\u2551')
  );

  return [top, ...lines, bottom].join('\n');
}
