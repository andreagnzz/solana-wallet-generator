import { Keypair, TransactionMessage, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import { BatchBuilder } from '../../src/bundler/multi-bundle/batch-builder';
import { buildReport, formatReportText } from '../../src/bundler/multi-bundle/batch-reporter';
import { SequencerResult } from '../../src/bundler/multi-bundle/sequencer';

function makeDummyTx(): VersionedTransaction {
  const payer = Keypair.generate();
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: '11111111111111111111111111111111',
    instructions: [
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1000,
      }),
    ],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([payer]);
  return tx;
}

// ─── BatchBuilder ──────────────────────────────────────────────

describe('BatchBuilder', () => {
  it('adds items and tracks them', () => {
    const builder = new BatchBuilder();
    const tx = makeDummyTx();

    const id = builder.add([tx], 10000);

    expect(id).toContain('batch-0');
    expect(builder.size()).toBe(1);
    expect(builder.getItem(0)?.tipLamports).toBe(10000);
  });

  it('tracks total tip lamports', () => {
    const builder = new BatchBuilder();

    builder.add([makeDummyTx()], 5000);
    builder.add([makeDummyTx()], 15000);
    builder.add([makeDummyTx()], 10000);

    expect(builder.totalTipLamports()).toBe(30000);
  });

  it('throws on empty transaction array', () => {
    const builder = new BatchBuilder();
    expect(() => builder.add([], 1000)).toThrow('at least one transaction');
  });

  it('throws when exceeding max bundle size', () => {
    const builder = new BatchBuilder({ maxBundleSize: 2 });
    const txs = [makeDummyTx(), makeDummyTx(), makeDummyTx()];

    expect(() => builder.add(txs, 1000)).toThrow('exceeds max size');
  });

  it('clear removes all items', () => {
    const builder = new BatchBuilder();
    builder.add([makeDummyTx()], 1000);
    builder.add([makeDummyTx()], 2000);
    expect(builder.size()).toBe(2);

    builder.clear();
    expect(builder.size()).toBe(0);
    expect(builder.totalTipLamports()).toBe(0);
  });

  it('getItems returns readonly array', () => {
    const builder = new BatchBuilder();
    builder.add([makeDummyTx()], 1000);

    const items = builder.getItems();
    expect(items.length).toBe(1);
    expect(items[0].transactions.length).toBe(1);
  });

  it('stores metadata', () => {
    const builder = new BatchBuilder();
    builder.add([makeDummyTx()], 1000, { label: 'test-bundle' });

    const item = builder.getItem(0)!;
    expect(item.metadata).toEqual({ label: 'test-bundle' });
  });

  it('getItem returns undefined for invalid index', () => {
    const builder = new BatchBuilder();
    expect(builder.getItem(5)).toBeUndefined();
  });
});

// ─── BatchReporter ─────────────────────────────────────────────

describe('BatchReporter', () => {
  const makeResult = (overrides: Partial<SequencerResult> = {}): SequencerResult => ({
    mode: 'sequential',
    summary: {
      total: 5,
      landed: 3,
      failed: 1,
      timeout: 1,
      pending: 0,
      successRate: 0.6,
      totalDurationMs: 5000,
    },
    aborted: false,
    itemResults: new Map([
      ['batch-0', 'landed'],
      ['batch-1', 'landed'],
      ['batch-2', 'landed'],
      ['batch-3', 'failed'],
      ['batch-4', 'timeout'],
    ]),
    ...overrides,
  });

  it('builds report with correct metrics', () => {
    const report = buildReport(makeResult());

    expect(report.mode).toBe('sequential');
    expect(report.totalBundles).toBe(5);
    expect(report.landed).toBe(3);
    expect(report.failed).toBe(1);
    expect(report.timeout).toBe(1);
    expect(report.successRate).toBe('60.0%');
    expect(report.aborted).toBe(false);
    expect(report.items.length).toBe(5);
  });

  it('includes abort reason when aborted', () => {
    const report = buildReport(makeResult({
      aborted: true,
      abortReason: 'Too many failures',
    }));

    expect(report.aborted).toBe(true);
    expect(report.abortReason).toBe('Too many failures');
  });

  it('formats report as text', () => {
    const report = buildReport(makeResult());
    const text = formatReportText(report);

    expect(text).toContain('Bundle Batch Report');
    expect(text).toContain('sequential');
    expect(text).toContain('60.0%');
    expect(text).toContain('[+] batch-0: landed');
    expect(text).toContain('[x] batch-3: failed');
    expect(text).toContain('[?] batch-4: timeout');
  });

  it('formats aborted report', () => {
    const report = buildReport(makeResult({
      aborted: true,
      abortReason: 'Critical failure',
    }));
    const text = formatReportText(report);

    expect(text).toContain('ABORTED');
    expect(text).toContain('Critical failure');
  });

  it('handles empty results', () => {
    const report = buildReport({
      mode: 'pipelined',
      summary: {
        total: 0, landed: 0, failed: 0, timeout: 0, pending: 0,
        successRate: 0, totalDurationMs: 0,
      },
      aborted: false,
      itemResults: new Map(),
    });

    expect(report.totalBundles).toBe(0);
    expect(report.successRate).toBe('0.0%');
    expect(report.items.length).toBe(0);
  });
});
