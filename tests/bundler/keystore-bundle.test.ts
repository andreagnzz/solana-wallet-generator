import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { packWallets } from '../../src/bundler/keystore/bundle-pack';
import { unpackBundle, listBundle, bundleInfo } from '../../src/bundler/keystore/bundle-unpack';
import { WalletBundleFile } from '../../src/bundler/keystore/bundle-index';

describe('Keystore Bundle', () => {
  const testPassword = 'TestPassword123!';
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swbundle-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createTestWallets(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      keypair: Keypair.generate(),
      label: `test-wallet-${i}`,
      tags: ['test', `group-${i % 2}`],
      group: i % 2 === 0 ? 'even' : 'odd',
    }));
  }

  test('pack and unpack round-trip preserves keypairs', async () => {
    const wallets = createTestWallets(3);
    const outputPath = path.join(tmpDir, 'test.swbundle');

    await packWallets({
      wallets,
      outputPath,
      password: testPassword,
      metadata: { name: 'Test Bundle' },
    });

    const result = await unpackBundle({
      bundlePath: outputPath,
      password: testPassword,
    });

    expect(result.wallets.length).toBe(3);

    for (let i = 0; i < wallets.length; i++) {
      expect(result.wallets[i].address).toBe(wallets[i].keypair.publicKey.toBase58());
      expect(result.wallets[i].keypair.publicKey.toBase58()).toBe(
        wallets[i].keypair.publicKey.toBase58()
      );
      expect(result.wallets[i].label).toBe(`test-wallet-${i}`);
    }
  });

  test('index is readable without password', async () => {
    const wallets = createTestWallets(5);
    const outputPath = path.join(tmpDir, 'test.swbundle');

    await packWallets({
      wallets,
      outputPath,
      password: testPassword,
    });

    const index = await listBundle(outputPath);
    expect(index.count).toBe(5);
    expect(index.wallets.length).toBe(5);

    // Verify addresses are visible
    for (let i = 0; i < wallets.length; i++) {
      expect(index.wallets[i].address).toBe(wallets[i].keypair.publicKey.toBase58());
      expect(index.wallets[i].label).toBe(`test-wallet-${i}`);
    }
  });

  test('wrong password throws error', async () => {
    const wallets = createTestWallets(1);
    const outputPath = path.join(tmpDir, 'test.swbundle');

    await packWallets({
      wallets,
      outputPath,
      password: testPassword,
    });

    await expect(
      unpackBundle({
        bundlePath: outputPath,
        password: 'WrongPassword123!',
      })
    ).rejects.toThrow();
  });

  test('bundle metadata is accessible without password', async () => {
    const wallets = createTestWallets(2);
    const outputPath = path.join(tmpDir, 'test.swbundle');

    await packWallets({
      wallets,
      outputPath,
      password: testPassword,
      metadata: {
        name: 'My Farm',
        description: 'Test bundle',
        network: 'devnet',
      },
    });

    const metadata = await bundleInfo(outputPath);
    expect(metadata.name).toBe('My Farm');
    expect(metadata.description).toBe('Test bundle');
    expect(metadata.network).toBe('devnet');
  });

  test('extract by indices', async () => {
    const wallets = createTestWallets(5);
    const outputPath = path.join(tmpDir, 'test.swbundle');

    await packWallets({
      wallets,
      outputPath,
      password: testPassword,
    });

    const result = await unpackBundle({
      bundlePath: outputPath,
      password: testPassword,
      extract: { indices: [0, 2, 4] },
    });

    expect(result.wallets.length).toBe(3);
    expect(result.wallets[0].index).toBe(0);
    expect(result.wallets[1].index).toBe(2);
    expect(result.wallets[2].index).toBe(4);
  });

  test('extract by label', async () => {
    const wallets = createTestWallets(3);
    const outputPath = path.join(tmpDir, 'test.swbundle');

    await packWallets({
      wallets,
      outputPath,
      password: testPassword,
    });

    const result = await unpackBundle({
      bundlePath: outputPath,
      password: testPassword,
      extract: { labels: ['test-wallet-1'] },
    });

    expect(result.wallets.length).toBe(1);
    expect(result.wallets[0].label).toBe('test-wallet-1');
  });

  test('extract by tags', async () => {
    const wallets = createTestWallets(4);
    const outputPath = path.join(tmpDir, 'test.swbundle');

    await packWallets({
      wallets,
      outputPath,
      password: testPassword,
    });

    const result = await unpackBundle({
      bundlePath: outputPath,
      password: testPassword,
      extract: { tags: ['group-0'] },
    });

    // Wallets 0 and 2 have tag 'group-0'
    expect(result.wallets.length).toBe(2);
  });

  test('tampered payload fails checksum', async () => {
    const wallets = createTestWallets(2);
    const outputPath = path.join(tmpDir, 'test.swbundle');

    await packWallets({
      wallets,
      outputPath,
      password: testPassword,
    });

    // Tamper with the file
    const raw = fs.readFileSync(outputPath, 'utf8');
    const bundle: WalletBundleFile = JSON.parse(raw);
    bundle.checksum = 'tampered_checksum_value';
    fs.writeFileSync(outputPath, JSON.stringify(bundle), 'utf8');

    // Should fail on checksum (or decryption depending on what was tampered)
    await expect(
      unpackBundle({
        bundlePath: outputPath,
        password: testPassword,
      })
    ).rejects.toThrow();
  });

  test('bundle file has correct format', async () => {
    const wallets = createTestWallets(1);
    const outputPath = path.join(tmpDir, 'test.swbundle');

    await packWallets({
      wallets,
      outputPath,
      password: testPassword,
    });

    const raw = fs.readFileSync(outputPath, 'utf8');
    const bundle: WalletBundleFile = JSON.parse(raw);

    expect(bundle.version).toBe('2.0.0');
    expect(bundle.format).toBe('solana-wallet-bundle');
    expect(bundle.encryption.algorithm).toBe('aes-256-gcm');
    expect(bundle.encryption.kdf).toBe('argon2id');
    expect(bundle.index.count).toBe(1);
    expect(bundle.payload).toBeDefined();
    expect(bundle.checksum).toBeDefined();
  });

  test('rejects empty bundle', async () => {
    await expect(
      packWallets({
        wallets: [],
        outputPath: path.join(tmpDir, 'empty.swbundle'),
        password: testPassword,
      })
    ).rejects.toThrow('Cannot create an empty bundle');
  });

  test('rejects short password', async () => {
    await expect(
      packWallets({
        wallets: createTestWallets(1),
        outputPath: path.join(tmpDir, 'test.swbundle'),
        password: 'short',
      })
    ).rejects.toThrow('Password must be at least 8 characters');
  });
});
