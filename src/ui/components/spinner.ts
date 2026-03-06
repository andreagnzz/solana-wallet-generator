import { createSpinner } from 'nanospinner';
import { theme } from '../theme';

export function createTaskSpinner(text: string) {
  return createSpinner(theme.secondary(text), {
    color: 'cyan',
  });
}

export function createDangerSpinner(text: string) {
  return createSpinner(theme.danger(text), {
    color: 'red',
  });
}

export function spinnerSuccess(spinner: ReturnType<typeof createSpinner>, text: string): void {
  spinner.success({ text: theme.primary(`\u2713 ${text}`) });
}

export function spinnerError(spinner: ReturnType<typeof createSpinner>, text: string): void {
  spinner.error({ text: theme.danger(`\u2717 ${text}`) });
}
