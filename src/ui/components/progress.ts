import { SingleBar, Presets } from 'cli-progress';
import { theme } from '../theme';

const CUSTOM_FORMAT =
  theme.secondary('  \u25C8 ') +
  '{bar}' + ' ' +
  theme.bright('{percentage}%') + ' ' +
  theme.muted('\u2502 {value}/{total}') + ' ' +
  theme.muted('[{duration_formatted}]');

export function createProgressBar(total: number, label?: string): SingleBar {
  const format = label
    ? CUSTOM_FORMAT + ' ' + theme.secondary(label)
    : CUSTOM_FORMAT;

  const bar = new SingleBar({
    format,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    barsize: 30,
  }, Presets.shades_classic);

  bar.start(total, 0);
  return bar;
}

export function createVanityProgress(): SingleBar {
  const bar = new SingleBar({
    format:
      theme.secondary('  \u25C8 ') +
      '{bar}' + ' ' +
      theme.muted('Attempts: ') + theme.bright('{value}') + '  ' +
      theme.muted('{duration_formatted}'),
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    barsize: 25,
  }, Presets.shades_classic);

  return bar;
}
