import {
  isValidSolanaAddress,
  isValidPrivateKey,
  validateMnemonicInput,
  validateDerivationPath,
  validateNetwork,
  validateWordCount,
  validateBatchCount,
  validateAccountCount,
  isValidRpcUrl,
  isValidBase58Pattern,
  validateAirdropAmount,
  sanitizeInput,
} from '../src/utils/validation';

describe('Solana Address Validation', () => {
  test('accepts valid Solana address', () => {
    // Well-known system program address
    expect(isValidSolanaAddress('11111111111111111111111111111111')).toBe(true);
  });

  test('rejects invalid address', () => {
    expect(isValidSolanaAddress('not-a-valid-address')).toBe(false);
    expect(isValidSolanaAddress('')).toBe(false);
    expect(isValidSolanaAddress('0x1234567890abcdef')).toBe(false);
  });

  test('rejects address with invalid characters', () => {
    expect(isValidSolanaAddress('OOOO0000llll1111')).toBe(false); // O and l not in base58
  });
});

describe('Private Key Validation', () => {
  test('rejects short key', () => {
    expect(isValidPrivateKey('short')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidPrivateKey('')).toBe(false);
  });
});

describe('Mnemonic Validation', () => {
  test('validates correct 12-word mnemonic', () => {
    const result = validateMnemonicInput(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    );
    expect(result.valid).toBe(true);
    expect(result.wordCount).toBe(12);
  });

  test('rejects empty mnemonic', () => {
    const result = validateMnemonicInput('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Mnemonic cannot be empty');
  });

  test('rejects wrong word count', () => {
    const result = validateMnemonicInput('one two three four five');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid word count');
  });

  test('rejects mnemonic with invalid checksum', () => {
    const result = validateMnemonicInput(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon'
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('checksum');
  });
});

describe('Derivation Path Validation', () => {
  test('accepts valid paths', () => {
    expect(validateDerivationPath("m/44'/501'/0'/0'").valid).toBe(true);
    expect(validateDerivationPath("m/44'/501'/{index}'/0'").valid).toBe(true);
  });

  test('rejects paths not starting with m/', () => {
    expect(validateDerivationPath("44'/501'/0'").valid).toBe(false);
    expect(validateDerivationPath("44'/501'/0'").error).toContain("must start with 'm/'");
  });
});

describe('Network Validation', () => {
  test('accepts valid networks', () => {
    expect(validateNetwork('mainnet')).toBe(true);
    expect(validateNetwork('devnet')).toBe(true);
    expect(validateNetwork('testnet')).toBe(true);
    expect(validateNetwork('custom')).toBe(true);
  });

  test('rejects invalid networks', () => {
    expect(validateNetwork('invalid')).toBe(false);
  });
});

describe('Word Count Validation', () => {
  test('accepts valid word counts', () => {
    expect(validateWordCount(12)).toBe(true);
    expect(validateWordCount(15)).toBe(true);
    expect(validateWordCount(18)).toBe(true);
    expect(validateWordCount(21)).toBe(true);
    expect(validateWordCount(24)).toBe(true);
  });

  test('rejects invalid word counts', () => {
    expect(validateWordCount(10)).toBe(false);
    expect(validateWordCount(13)).toBe(false);
  });
});

describe('Batch Count Validation', () => {
  test('accepts valid counts', () => {
    expect(validateBatchCount(1).valid).toBe(true);
    expect(validateBatchCount(10000).valid).toBe(true);
  });

  test('rejects invalid counts', () => {
    expect(validateBatchCount(0).valid).toBe(false);
    expect(validateBatchCount(-1).valid).toBe(false);
    expect(validateBatchCount(10001).valid).toBe(false);
  });
});

describe('Account Count Validation', () => {
  test('accepts valid counts', () => {
    expect(validateAccountCount(1).valid).toBe(true);
    expect(validateAccountCount(100).valid).toBe(true);
  });

  test('rejects invalid counts', () => {
    expect(validateAccountCount(0).valid).toBe(false);
    expect(validateAccountCount(101).valid).toBe(false);
  });
});

describe('RPC URL Validation', () => {
  test('accepts valid URLs', () => {
    expect(isValidRpcUrl('https://api.mainnet-beta.solana.com')).toBe(true);
    expect(isValidRpcUrl('http://localhost:8899')).toBe(true);
  });

  test('rejects invalid URLs', () => {
    expect(isValidRpcUrl('not-a-url')).toBe(false);
    expect(isValidRpcUrl('')).toBe(false);
    expect(isValidRpcUrl('ftp://server.com')).toBe(false);
  });
});

describe('Base58 Pattern Validation', () => {
  test('accepts valid base58 patterns', () => {
    expect(isValidBase58Pattern('SoL')).toBe(true);  // S, o, L are valid base58
    expect(isValidBase58Pattern('abc123')).toBe(true);
  });

  test('rejects patterns with invalid characters', () => {
    expect(isValidBase58Pattern('0OIl')).toBe(false); // 0, O, I, l not in base58
    expect(isValidBase58Pattern('')).toBe(false);
  });
});

describe('Airdrop Amount Validation', () => {
  test('accepts valid devnet airdrop', () => {
    expect(validateAirdropAmount(1, 'devnet').valid).toBe(true);
    expect(validateAirdropAmount(2, 'testnet').valid).toBe(true);
  });

  test('rejects mainnet airdrop', () => {
    expect(validateAirdropAmount(1, 'mainnet').valid).toBe(false);
    expect(validateAirdropAmount(1, 'mainnet').error).toContain('not available on mainnet');
  });

  test('rejects excessive amount', () => {
    expect(validateAirdropAmount(3, 'devnet').valid).toBe(false);
  });

  test('rejects zero/negative amounts', () => {
    expect(validateAirdropAmount(0, 'devnet').valid).toBe(false);
    expect(validateAirdropAmount(-1, 'devnet').valid).toBe(false);
  });
});

describe('Input Sanitization', () => {
  test('removes special characters', () => {
    expect(sanitizeInput('hello<script>')).toBe('helloscript');
    expect(sanitizeInput('normal text')).toBe('normal text');
  });

  test('preserves valid characters', () => {
    expect(sanitizeInput("m/44'/501'/0'")).toBe("m/44'/501'/0'");
  });

  test('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });
});
