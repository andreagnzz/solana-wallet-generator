import { withRetry, classifySolanaError } from '../../src/bundler/shared/retry';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const result = await withRetry(async () => 42, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result).toBe(42);
  });

  it('retries on retryable error and succeeds', async () => {
    let attempt = 0;
    const result = await withRetry(
      async () => {
        attempt++;
        if (attempt < 3) throw new Error('Request timed out');
        return 'success';
      },
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 50 }
    );

    expect(result).toBe('success');
    expect(attempt).toBe(3);
  });

  it('throws after max attempts exhausted', async () => {
    await expect(
      withRetry(
        async () => { throw new Error('Request timed out'); },
        { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 50 }
      )
    ).rejects.toThrow('Request timed out');
  });

  it('does not retry on non-retryable error (insufficient funds)', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => { attempts++; throw new Error('insufficient funds'); },
        { maxAttempts: 3, baseDelayMs: 10 }
      )
    ).rejects.toThrow('insufficient funds');

    expect(attempts).toBe(1);
  });

  it('does not retry on simulation-failed', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => { attempts++; throw new Error('Simulation failed'); },
        { maxAttempts: 3, baseDelayMs: 10 }
      )
    ).rejects.toThrow('Simulation failed');

    expect(attempts).toBe(1);
  });

  it('retries on blockhash-expired', async () => {
    let attempt = 0;
    await withRetry(
      async () => {
        attempt++;
        if (attempt === 1) throw new Error('Blockhash not found');
        return true;
      },
      { maxAttempts: 3, baseDelayMs: 10 }
    );
    expect(attempt).toBe(2);
  });

  it('retries on rate-limited', async () => {
    let attempt = 0;
    await withRetry(
      async () => {
        attempt++;
        if (attempt === 1) throw new Error('429 Too Many Requests');
        return true;
      },
      { maxAttempts: 3, baseDelayMs: 10 }
    );
    expect(attempt).toBe(2);
  });

  it('retries on node-behind', async () => {
    let attempt = 0;
    await withRetry(
      async () => {
        attempt++;
        if (attempt === 1) throw new Error('node is behind');
        return true;
      },
      { maxAttempts: 3, baseDelayMs: 10 }
    );
    expect(attempt).toBe(2);
  });

  it('retries on unknown error', async () => {
    let attempt = 0;
    await withRetry(
      async () => {
        attempt++;
        if (attempt === 1) throw new Error('random glitch');
        return true;
      },
      { maxAttempts: 3, baseDelayMs: 10 }
    );
    expect(attempt).toBe(2);
  });

  it('calls onRetry callback', async () => {
    const retries: number[] = [];
    let attempt = 0;

    await withRetry(
      async () => {
        attempt++;
        if (attempt < 3) throw new Error('Request timed out');
        return true;
      },
      {
        maxAttempts: 3,
        baseDelayMs: 10,
        onRetry: (a) => retries.push(a),
      }
    );

    expect(retries).toEqual([1, 2]);
  });

  it('respects custom shouldRetry', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => { attempts++; throw new Error('custom error'); },
        {
          maxAttempts: 3,
          baseDelayMs: 10,
          shouldRetry: () => false,
        }
      )
    ).rejects.toThrow('custom error');

    expect(attempts).toBe(1);
  });

  it('converts non-Error throws to Error', async () => {
    await expect(
      withRetry(
        async () => { throw 'string error'; },
        { maxAttempts: 1, baseDelayMs: 10 }
      )
    ).rejects.toThrow('string error');
  });

  it('uses default options when none provided', async () => {
    const result = await withRetry(async () => 'ok');
    expect(result).toBe('ok');
  });
});

describe('classifySolanaError — additional cases', () => {
  it('classifies node-behind with slot keyword', () => {
    expect(classifySolanaError(new Error('slot 1234 behind by 5'))).toBe('node-behind');
  });

  it('classifies timed out', () => {
    expect(classifySolanaError(new Error('timed out waiting'))).toBe('timeout');
  });
});
