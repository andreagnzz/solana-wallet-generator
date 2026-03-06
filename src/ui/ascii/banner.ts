import figlet from 'figlet';
import { theme, sym } from '../theme';

export function renderMainBanner(): void {
  const ascii = figlet.textSync('SOLANA', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
  });

  const subtext = figlet.textSync('WALLET SUITE', {
    font: 'Small',
    horizontalLayout: 'default',
  });

  console.log();
  console.log(theme.solanaGradient(ascii));
  console.log(theme.titleGradient(subtext));
  console.log();
  console.log(
    theme.muted('  ') +
    theme.secondary(`${sym.diamond} Generator`) +
    theme.muted(' \u00B7 ') +
    theme.secondary(`${sym.diamond} Bundler`) +
    theme.muted(' \u00B7 ') +
    theme.secondary(`${sym.diamond} Jito MEV`) +
    theme.muted(' \u00B7 ') +
    theme.secondary(`${sym.diamond} Rotation`)
  );
  console.log(theme.muted('  v1.0.0 \u00B7 mainnet-beta'));
  console.log();
}

export function renderCommandBanner(command: string, description: string): void {
  const line = sym.dash.repeat(60);
  console.log();
  console.log(
    theme.primary(`  ${sym.diamond} ${command.toUpperCase()}`) +
    theme.muted(` \u00B7 ${description}`)
  );
  console.log(theme.muted(`  ${line}`));
  console.log();
}

export function renderDangerBanner(): void {
  console.log();
  console.log(theme.danger.bold([
    '  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557',
    '  \u2551   \u26A0  SENSITIVE OPERATION  \u26A0             \u2551',
    '  \u2551   Private keys will be displayed.       \u2551',
    '  \u2551   Ensure no one can see your screen.    \u2551',
    '  \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D',
  ].join('\n')));
  console.log();
}

export async function renderTypewriterBanner(text: string): Promise<void> {
  process.stdout.write('  ');
  for (const char of text) {
    process.stdout.write(theme.primary(char));
    await new Promise(r => setTimeout(r, 30));
  }
  console.log();
}
