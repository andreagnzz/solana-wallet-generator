import { theme, sym, fmt } from '../../src/ui/theme';
import { icons, statusIcon } from '../../src/ui/ascii/icons';
import { renderFrame, renderDoubleFrame } from '../../src/ui/ascii/frames';
import { truncateAddress, formatDuration, renderKeyValue } from '../../src/ui/utils/format';

describe('UI Theme', () => {
  it('exports color functions', () => {
    expect(typeof theme.primary).toBe('function');
    expect(typeof theme.secondary).toBe('function');
    expect(typeof theme.danger).toBe('function');
    expect(typeof theme.muted).toBe('function');
    expect(typeof theme.titleGradient).toBe('function');
    expect(typeof theme.solanaGradient).toBe('function');
  });

  it('exports symbols', () => {
    expect(sym.success).toBeDefined();
    expect(sym.error).toBeDefined();
    expect(sym.arrow).toBeDefined();
    expect(sym.diamond).toBeDefined();
  });

  it('formats SOL amounts', () => {
    const result = fmt.sol(1_000_000_000);
    expect(result).toContain('1.000000000');
    expect(result).toContain('SOL');
  });

  it('formats addresses', () => {
    const addr = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    const result = fmt.address(addr);
    expect(result).toContain('7xKX');
    expect(result).toContain('AsU');
  });

  it('formats network labels', () => {
    const mainnet = fmt.network('mainnet');
    const devnet = fmt.network('devnet');
    expect(mainnet).toContain('MAINNET');
    expect(devnet).toContain('DEVNET');
  });
});

describe('UI Icons', () => {
  it('exports ASCII art icons', () => {
    expect(icons.wallet).toBeDefined();
    expect(icons.lock).toBeDefined();
    expect(icons.key).toBeDefined();
    expect(icons.shield).toBeDefined();
    expect(icons.bundle).toBeDefined();
  });

  it('exports status icons', () => {
    expect(statusIcon.success).toBeDefined();
    expect(statusIcon.error).toBeDefined();
    expect(statusIcon.pending).toBeDefined();
  });
});

describe('UI Frames', () => {
  it('renders a single frame', () => {
    const frame = renderFrame('Hello World', { width: 30 });
    expect(frame).toContain('Hello World');
    expect(frame.split('\n').length).toBe(3);
  });

  it('renders a double frame with title', () => {
    const frame = renderDoubleFrame('Content', { title: 'Title', width: 40 });
    expect(frame).toContain('Title');
    expect(frame).toContain('Content');
  });
});

describe('UI Format Utils', () => {
  it('truncates addresses', () => {
    const addr = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    const truncated = truncateAddress(addr, 4);
    expect(truncated).toBe('7xKX...gAsU');
  });

  it('formats durations', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(2500)).toBe('2.5s');
    expect(formatDuration(65000)).toBe('1m 5s');
  });

  it('renders key-value pairs', () => {
    const kv = renderKeyValue('Label', 'Value');
    expect(kv).toContain('Label');
    expect(kv).toContain('Value');
  });
});
