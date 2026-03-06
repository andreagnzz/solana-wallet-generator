import { encryptKeystore, decryptKeystore } from '../src/crypto/keystore';
import { EncryptedKeystore } from '../src/types';

describe('Keystore Encryption/Decryption', () => {
  const testData = JSON.stringify({
    mnemonic: 'test mnemonic phrase here',
    accounts: [{ address: 'TestAddress123', privateKey: 'TestPrivateKey456' }],
  });
  const testPassword = 'SecurePassword123!';

  test('encrypts and decrypts data correctly', async () => {
    const encrypted = await encryptKeystore(testData, testPassword);
    const decrypted = await decryptKeystore(encrypted, testPassword);
    expect(decrypted).toBe(testData);
  });

  test('encrypted keystore has correct structure', async () => {
    const encrypted = await encryptKeystore(testData, testPassword);

    expect(encrypted.version).toBe(1);
    expect(encrypted.algorithm).toBe('aes-256-gcm');
    expect(encrypted.kdf).toBe('argon2id');
    expect(encrypted.kdfParams.salt).toBeDefined();
    expect(encrypted.kdfParams.iterations).toBe(3);
    expect(encrypted.kdfParams.memory).toBe(65536);
    expect(encrypted.kdfParams.parallelism).toBe(4);
    expect(encrypted.kdfParams.keyLen).toBe(32);
    expect(encrypted.cipher.iv).toBeDefined();
    expect(encrypted.cipher.tag).toBeDefined();
    expect(encrypted.cipher.data).toBeDefined();
    expect(encrypted.checksum).toBeDefined();
  });

  test('fails with wrong password', async () => {
    const encrypted = await encryptKeystore(testData, testPassword);
    await expect(
      decryptKeystore(encrypted, 'WrongPassword123!')
    ).rejects.toThrow();
  });

  test('different encryptions produce different ciphertexts', async () => {
    const enc1 = await encryptKeystore(testData, testPassword);
    const enc2 = await encryptKeystore(testData, testPassword);

    // Different salts and IVs should produce different ciphertexts
    expect(enc1.kdfParams.salt).not.toBe(enc2.kdfParams.salt);
    expect(enc1.cipher.iv).not.toBe(enc2.cipher.iv);
    expect(enc1.cipher.data).not.toBe(enc2.cipher.data);
  });

  test('detects tampered ciphertext', async () => {
    const encrypted = await encryptKeystore(testData, testPassword);

    // Tamper with the encrypted data
    const tampered: EncryptedKeystore = {
      ...encrypted,
      cipher: {
        ...encrypted.cipher,
        data: encrypted.cipher.data.replace(/^.{2}/, 'ff'),
      },
    };

    await expect(
      decryptKeystore(tampered, testPassword)
    ).rejects.toThrow();
  });

  test('handles empty string data', async () => {
    const encrypted = await encryptKeystore('', testPassword);
    const decrypted = await decryptKeystore(encrypted, testPassword);
    expect(decrypted).toBe('');
  });

  test('handles large data', async () => {
    const largeData = 'x'.repeat(100000);
    const encrypted = await encryptKeystore(largeData, testPassword);
    const decrypted = await decryptKeystore(encrypted, testPassword);
    expect(decrypted).toBe(largeData);
  });

  test('rejects unsupported keystore version', async () => {
    const encrypted = await encryptKeystore(testData, testPassword);
    const badVersion: EncryptedKeystore = { ...encrypted, version: 99 };

    await expect(
      decryptKeystore(badVersion, testPassword)
    ).rejects.toThrow('Unsupported keystore version');
  });
});
