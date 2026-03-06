import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { packWallets, addWalletToBundle, removeWalletFromBundle, mergeBundles } from '../../src/bundler/keystore/bundle-pack';
import { unpackBundle } from '../../src/bundler/keystore/bundle-unpack';

describe('Bundle Pack — add, remove, merge', () => {
  const testPassword = 'TestPassword123!';
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swbundle-extra-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createTestWallets(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      keypair: Keypair.generate(),
      label: `wallet-${i}`,
      tags: ['test'],
    }));
  }

  test('addWalletToBundle adds a wallet and preserves existing ones', async () => {
    const wallets = createTestWallets(2);
    const bundlePath = path.join(tmpDir, 'add-test.swbundle');

    await packWallets({
      wallets,
      outputPath: bundlePath,
      password: testPassword,
      metadata: { name: 'Add Test' },
    });

    const newWallet = {
      keypair: Keypair.generate(),
      label: 'new-wallet',
      tags: ['added'],
    };

    await addWalletToBundle(bundlePath, testPassword, newWallet);

    const result = await unpackBundle({ bundlePath, password: testPassword });
    expect(result.wallets.length).toBe(3);

    // Original wallets preserved
    expect(result.wallets[0].address).toBe(wallets[0].keypair.publicKey.toBase58());
    expect(result.wallets[1].address).toBe(wallets[1].keypair.publicKey.toBase58());

    // New wallet added
    expect(result.wallets[2].address).toBe(newWallet.keypair.publicKey.toBase58());
    expect(result.wallets[2].label).toBe('new-wallet');
  });

  test('removeWalletFromBundle removes by index', async () => {
    const wallets = createTestWallets(3);
    const bundlePath = path.join(tmpDir, 'remove-test.swbundle');

    await packWallets({
      wallets,
      outputPath: bundlePath,
      password: testPassword,
    });

    await removeWalletFromBundle(bundlePath, testPassword, 1);

    const result = await unpackBundle({ bundlePath, password: testPassword });
    expect(result.wallets.length).toBe(2);

    // Wallet at index 1 removed — remaining are original 0 and 2
    const addresses = result.wallets.map(w => w.address);
    expect(addresses).toContain(wallets[0].keypair.publicKey.toBase58());
    expect(addresses).toContain(wallets[2].keypair.publicKey.toBase58());
    expect(addresses).not.toContain(wallets[1].keypair.publicKey.toBase58());
  });

  test('removeWalletFromBundle throws for non-existent index', async () => {
    const wallets = createTestWallets(2);
    const bundlePath = path.join(tmpDir, 'remove-fail.swbundle');

    await packWallets({
      wallets,
      outputPath: bundlePath,
      password: testPassword,
    });

    await expect(
      removeWalletFromBundle(bundlePath, testPassword, 99)
    ).rejects.toThrow('not found');
  });

  test('mergeBundles combines wallets from multiple bundles', async () => {
    const wallets1 = createTestWallets(2);
    const wallets2 = createTestWallets(3);
    const path1 = path.join(tmpDir, 'merge-a.swbundle');
    const path2 = path.join(tmpDir, 'merge-b.swbundle');
    const outputPath = path.join(tmpDir, 'merged.swbundle');

    await packWallets({ wallets: wallets1, outputPath: path1, password: testPassword });
    await packWallets({ wallets: wallets2, outputPath: path2, password: 'OtherPass123!' });

    await mergeBundles(
      [path1, path2],
      [testPassword, 'OtherPass123!'],
      outputPath,
      'MergedPass123!'
    );

    const result = await unpackBundle({ bundlePath: outputPath, password: 'MergedPass123!' });
    expect(result.wallets.length).toBe(5);

    // All original addresses present
    const allAddresses = result.wallets.map(w => w.address);
    for (const w of [...wallets1, ...wallets2]) {
      expect(allAddresses).toContain(w.keypair.publicKey.toBase58());
    }
  });

  test('mergeBundles throws when passwords array length mismatches', async () => {
    await expect(
      mergeBundles(['a.swbundle', 'b.swbundle'], ['pass1'], 'out.swbundle', 'newpass1')
    ).rejects.toThrow('corresponding password');
  });

  test('packWallets appends .swbundle extension if missing', async () => {
    const wallets = createTestWallets(1);
    const outputPath = path.join(tmpDir, 'noext');

    const result = await packWallets({
      wallets,
      outputPath,
      password: testPassword,
    });

    expect(result).toBe(`${outputPath}.swbundle`);
    expect(fs.existsSync(`${outputPath}.swbundle`)).toBe(true);
  });
});
