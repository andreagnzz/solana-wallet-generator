import { buildBundleIndex, filterIndex, BundleWalletData, BundleIndex } from '../../src/bundler/keystore/bundle-index';

describe('buildBundleIndex', () => {
  const wallets: BundleWalletData[] = [
    { index: 0, address: 'Addr0', privateKey: 'secret0', label: 'w0', tags: ['a', 'b'], group: 'g1' },
    { index: 1, address: 'Addr1', privateKey: 'secret1', label: 'w1', tags: ['b', 'c'], group: 'g2' },
    { index: 2, address: 'Addr2', privateKey: 'secret2', label: 'w2', tags: ['a'], group: 'g1' },
    { index: 3, address: 'Addr3', privateKey: 'secret3' },
  ];

  it('creates index with correct count', () => {
    const index = buildBundleIndex(wallets);
    expect(index.count).toBe(4);
    expect(index.wallets.length).toBe(4);
  });

  it('strips private keys from index entries', () => {
    const index = buildBundleIndex(wallets);
    for (const entry of index.wallets) {
      expect((entry as any).privateKey).toBeUndefined();
    }
  });

  it('preserves public fields', () => {
    const index = buildBundleIndex(wallets);
    expect(index.wallets[0].address).toBe('Addr0');
    expect(index.wallets[0].label).toBe('w0');
    expect(index.wallets[0].tags).toEqual(['a', 'b']);
    expect(index.wallets[0].group).toBe('g1');
  });

  it('handles wallets without optional fields', () => {
    const index = buildBundleIndex(wallets);
    expect(index.wallets[3].label).toBeUndefined();
    expect(index.wallets[3].tags).toBeUndefined();
    expect(index.wallets[3].group).toBeUndefined();
  });

  it('handles empty array', () => {
    const index = buildBundleIndex([]);
    expect(index.count).toBe(0);
    expect(index.wallets).toEqual([]);
  });
});

describe('filterIndex', () => {
  const index: BundleIndex = {
    count: 5,
    wallets: [
      { index: 0, address: 'A0', label: 'alpha', tags: ['fast', 'new'], group: 'team1' },
      { index: 1, address: 'A1', label: 'beta', tags: ['slow'], group: 'team1' },
      { index: 2, address: 'A2', label: 'gamma', tags: ['fast'], group: 'team2' },
      { index: 3, address: 'A3', label: 'delta', tags: ['new'], group: 'team2' },
      { index: 4, address: 'A4' },
    ],
  };

  it('filters by indices', () => {
    const result = filterIndex(index, { indices: [1, 3] });
    expect(result.length).toBe(2);
    expect(result[0].index).toBe(1);
    expect(result[1].index).toBe(3);
  });

  it('filters by labels', () => {
    const result = filterIndex(index, { labels: ['alpha', 'gamma'] });
    expect(result.length).toBe(2);
    expect(result[0].label).toBe('alpha');
    expect(result[1].label).toBe('gamma');
  });

  it('filters by tags', () => {
    const result = filterIndex(index, { tags: ['fast'] });
    expect(result.length).toBe(2);
    expect(result.map(e => e.index)).toEqual([0, 2]);
  });

  it('filters by groups', () => {
    const result = filterIndex(index, { groups: ['team2'] });
    expect(result.length).toBe(2);
    expect(result.map(e => e.index)).toEqual([2, 3]);
  });

  it('combines multiple filters (AND logic)', () => {
    const result = filterIndex(index, { tags: ['fast'], groups: ['team2'] });
    expect(result.length).toBe(1);
    expect(result[0].label).toBe('gamma');
  });

  it('returns all when no filter applied', () => {
    const result = filterIndex(index, {});
    expect(result.length).toBe(5);
  });

  it('returns empty for non-matching filter', () => {
    const result = filterIndex(index, { labels: ['nonexistent'] });
    expect(result.length).toBe(0);
  });

  it('skips entries without label/tags/group for those filters', () => {
    const result = filterIndex(index, { labels: ['alpha'] });
    // Entry 4 has no label, should not match
    expect(result.length).toBe(1);

    const tagResult = filterIndex(index, { tags: ['fast'] });
    // Entry 4 has no tags
    expect(tagResult.every(e => e.index !== 4)).toBe(true);

    const groupResult = filterIndex(index, { groups: ['team1'] });
    expect(groupResult.every(e => e.index !== 4)).toBe(true);
  });
});
