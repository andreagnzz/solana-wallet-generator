import { theme } from '../theme';

export const icons = {
  wallet: theme.secondary([
    ' \u250C\u2500\u2500\u2500\u2510',
    ' \u2502 W \u2502',
    ' \u2514\u2500\u2500\u2500\u2518',
  ].join('\n')),

  lock: theme.danger([
    '  \u250C\u2510 ',
    ' \u250C\u2534\u2534\u2510',
    ' \u2502\u25CF\u25CF\u2502',
    ' \u2514\u2500\u2500\u2518',
  ].join('\n')),

  key: theme.accent([
    '\u25CF\u2500\u2500\u252C\u2500',
    '    \u2514\u2500',
  ].join('\n')),

  shield: theme.primary([
    ' /\u2588\u2588\\',
    ' \u2588\u2713\u2588',
    '  \\/ ',
  ].join('\n')),

  bundle: theme.secondary([
    '\u250C\u252C\u252C\u2510',
    '\u2502\u2502\u2502\u2502',
    '\u2514\u2534\u2534\u2518',
  ].join('\n')),
};

export const statusIcon = {
  success: theme.primary('\u2713'),
  error:   theme.danger('\u2717'),
  warning: theme.accent('\u26A0'),
  pending: theme.accent('\u25D0'),
  sending: theme.secondary('\u2192'),
  queued:  theme.muted('\u00B7'),
  skip:    theme.muted('\u2298'),
};
