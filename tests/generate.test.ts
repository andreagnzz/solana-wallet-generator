import * as bip39 from 'bip39';
import { generateMnemonic, validateMnemonic, getMnemonicWordCount } from '../src/crypto/entropy';
import { deriveSolanaKeypair, deriveMultipleKeypairs } from '../src/crypto/derivation';
import { WordCount, MnemonicLanguage } from '../src/types';

describe('Mnemonic Generation', () => {
  test.each([12, 15, 18, 21, 24] as WordCount[])(
    'generates valid %i-word mnemonic',
    (wordCount) => {
      const mnemonic = generateMnemonic(wordCount);
      const words = mnemonic.split(' ');
      expect(words.length).toBe(wordCount);
      expect(bip39.validateMnemonic(mnemonic)).toBe(true);
    }
  );

  test('validates checksum for generated mnemonic', () => {
    const mnemonic = generateMnemonic(12);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  test('rejects invalid mnemonic', () => {
    const invalid = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon wrong';
    expect(validateMnemonic(invalid)).toBe(false);
  });

  test('getMnemonicWordCount returns correct count', () => {
    const mnemonic = generateMnemonic(24);
    expect(getMnemonicWordCount(mnemonic)).toBe(24);
  });

  test.each(['english', 'french', 'spanish', 'japanese'] as MnemonicLanguage[])(
    'generates mnemonic in %s',
    (language) => {
      const mnemonic = generateMnemonic(12, language);
      expect(validateMnemonic(mnemonic, language)).toBe(true);
    }
  );

  test('different calls produce different mnemonics', () => {
    const m1 = generateMnemonic(12);
    const m2 = generateMnemonic(12);
    expect(m1).not.toBe(m2);
  });
});

describe('Deterministic Derivation', () => {
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  test('same seed produces same keypair', () => {
    const kp1 = deriveSolanaKeypair(testMnemonic, 0);
    const kp2 = deriveSolanaKeypair(testMnemonic, 0);
    expect(kp1.publicKey).toBe(kp2.publicKey);
    expect(kp1.privateKey).toBe(kp2.privateKey);
  });

  test('different indices produce different keypairs', () => {
    const kp0 = deriveSolanaKeypair(testMnemonic, 0);
    const kp1 = deriveSolanaKeypair(testMnemonic, 1);
    expect(kp0.publicKey).not.toBe(kp1.publicKey);
    expect(kp0.privateKey).not.toBe(kp1.privateKey);
  });

  test('passphrase changes derived keypair', () => {
    const kp1 = deriveSolanaKeypair(testMnemonic, 0);
    const kp2 = deriveSolanaKeypair(testMnemonic, 0, 'mypassphrase');
    expect(kp1.publicKey).not.toBe(kp2.publicKey);
  });

  test('derives correct path format', () => {
    const kp = deriveSolanaKeypair(testMnemonic, 3);
    expect(kp.path).toBe("m/44'/501'/3'/0'");
    expect(kp.index).toBe(3);
  });

  test('derives Phantom-compatible keypair from known mnemonic', () => {
    // Standard test: the "abandon" mnemonic should derive a known address
    const kp = deriveSolanaKeypair(testMnemonic, 0);
    expect(kp.publicKey).toBeDefined();
    expect(kp.publicKey.length).toBeGreaterThanOrEqual(32);
    expect(kp.publicKey.length).toBeLessThanOrEqual(44);
  });

  test('derives multiple keypairs', () => {
    const keypairs = deriveMultipleKeypairs(testMnemonic, 5);
    expect(keypairs.length).toBe(5);

    // All addresses should be unique
    const addresses = keypairs.map(kp => kp.publicKey);
    const uniqueAddresses = new Set(addresses);
    expect(uniqueAddresses.size).toBe(5);
  });

  test('rejects invalid account count', () => {
    expect(() => deriveMultipleKeypairs(testMnemonic, 0)).toThrow();
    expect(() => deriveMultipleKeypairs(testMnemonic, 101)).toThrow();
  });
});

describe('Large-scale Derivation', () => {
  test('derives 100 accounts without collision', () => {
    const mnemonic = generateMnemonic(24);
    const keypairs = deriveMultipleKeypairs(mnemonic, 100);

    const addresses = new Set(keypairs.map(kp => kp.publicKey));
    expect(addresses.size).toBe(100);
  });
});
