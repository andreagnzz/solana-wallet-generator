import { renderMainBanner, renderTypewriterBanner } from '../ascii/banner';
import { theme, sym } from '../theme';

export async function renderWelcomeScreen(): Promise<void> {
  renderMainBanner();
  await renderTypewriterBanner('Initializing secure environment...');
  console.log();
  console.log(
    theme.muted('  ') +
    theme.primary(`${sym.success} Crypto engine ready`) +
    theme.muted('  ') +
    theme.primary(`${sym.success} Network connected`)
  );
  console.log();
}

export function renderQuickWelcome(command: string): void {
  const line = sym.dash.repeat(50);
  console.log();
  console.log(
    theme.solanaGradient(`  ${sym.diamond} SOLANA WALLET SUITE`) +
    theme.muted(` ${sym.arrow} `) +
    theme.bright(command.toUpperCase())
  );
  console.log(theme.muted(`  ${line}`));
  console.log();
}
