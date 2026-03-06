import ansiEscapes from 'ansi-escapes';

export function clearScreen(): void {
  process.stdout.write(ansiEscapes.clearScreen);
}

export function eraseLines(count: number): void {
  if (count > 0) {
    process.stdout.write(ansiEscapes.eraseLines(count));
  }
}

export function hideCursor(): void {
  process.stdout.write(ansiEscapes.cursorHide);
}

export function showCursor(): void {
  process.stdout.write(ansiEscapes.cursorShow);
}
