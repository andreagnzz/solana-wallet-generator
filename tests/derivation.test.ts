import {
  deriveSolanaKeypair,
  deriveMultipleKeypairs,
  keypairFromPrivateKey,
  keypairFromSeed,
  getDerivationPath,
  isValidDerivationPath,
} from '../src/crypto/derivation';

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('HD Derivation Paths', () => {
  test('Phantom/Solflare path format', () => {
    const path = getDerivationPath('phantom');
    expect(path).toBe("m/44'/501'/{index}'/0'");
  });

  test('Ledger legacy path format', () => {
    const path = getDerivationPath('ledger-legacy');
    expect(path).toBe("m/44'/501'/{index}'");
  });

  test('Ledger new path format', () => {
    const path = getDerivationPath('ledger-new');
    expect(path).toBe("m/44'/501'/{account}'/0'/{index}'");
  });

  test('validates correct derivation paths', () => {
    expect(isValidDerivationPath("m/44'/501'/0'/0'")).toBe(true);
    expect(isValidDerivationPath("m/44'/501'/{index}'/0'")).toBe(true);
    expect(isValidDerivationPath("m/44'/501'/0'")).toBe(true);
  });

  test('rejects invalid derivation paths', () => {
    expect(isValidDerivationPath('invalid')).toBe(false);
    expect(isValidDerivationPath('/44/501')).toBe(false);
    expect(isValidDerivationPath('')).toBe(false);
  });

  test('Phantom derivation path produces correct index paths', () => {
    const kp0 = deriveSolanaKeypair(TEST_MNEMONIC, 0);
    const kp5 = deriveSolanaKeypair(TEST_MNEMONIC, 5);

    expect(kp0.path).toBe("m/44'/501'/0'/0'");
    expect(kp5.path).toBe("m/44'/501'/5'/0'");
  });

  test('Ledger legacy derivation produces different keys', () => {
    const ledgerPath = "m/44'/501'/{index}'";
    const phantomPath = "m/44'/501'/{index}'/0'";

    const kpLedger = deriveSolanaKeypair(TEST_MNEMONIC, 0, undefined, ledgerPath);
    const kpPhantom = deriveSolanaKeypair(TEST_MNEMONIC, 0, undefined, phantomPath);

    expect(kpLedger.publicKey).not.toBe(kpPhantom.publicKey);
  });
});

describe('Key Recovery', () => {
  test('recovers keypair from private key', () => {
    const original = deriveSolanaKeypair(TEST_MNEMONIC, 0);
    const recovered = keypairFromPrivateKey(original.privateKey);

    expect(recovered.publicKey.toBase58()).toBe(original.publicKey);
  });

  test('recovers keypair from seed', () => {
    const original = deriveSolanaKeypair(TEST_MNEMONIC, 0);
    const recovered = keypairFromSeed(original.privateKeySeed);

    expect(recovered.publicKey.toBase58()).toBe(original.publicKey);
  });

  test('rejects invalid seed length', () => {
    expect(() => keypairFromSeed('short')).toThrow('Seed must be exactly 32 bytes');
  });
});

describe('Derivation with 100 accounts', () => {
  test('no address collisions in 100 accounts', () => {
    const keypairs = deriveMultipleKeypairs(TEST_MNEMONIC, 100);
    const addresses = keypairs.map(kp => kp.publicKey);
    const unique = new Set(addresses);

    expect(unique.size).toBe(100);
    expect(keypairs.length).toBe(100);
  });

  test('all keypairs have valid structure', () => {
    const keypairs = deriveMultipleKeypairs(TEST_MNEMONIC, 10);

    for (const kp of keypairs) {
      expect(kp.publicKey).toBeDefined();
      expect(kp.publicKey.length).toBeGreaterThanOrEqual(32);
      expect(kp.privateKey).toBeDefined();
      expect(kp.privateKeySeed).toBeDefined();
      expect(kp.path).toMatch(/^m\/44'\/501'\/\d+'\/0'$/);
      expect(typeof kp.index).toBe('number');
    }
  });
});
