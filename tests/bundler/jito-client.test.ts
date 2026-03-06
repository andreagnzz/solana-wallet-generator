import axios from 'axios';
import { JitoClient, JITO_ENDPOINTS } from '../../src/bundler/jito/jito-client';

jest.mock('axios', () => {
  const mockCreate = jest.fn(() => ({
    post: jest.fn(),
  }));
  return {
    __esModule: true,
    default: {
      create: mockCreate,
      get: jest.fn(),
    },
  };
});

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('JitoClient', () => {
  let mockPost: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPost = jest.fn();
    (mockedAxios.create as jest.Mock).mockReturnValue({ post: mockPost });
  });

  test('sendBundle returns result on success', async () => {
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: '2.0', id: 1, result: 'bundle-id-123' },
    });

    const client = new JitoClient({ region: 'mainnet' });
    const result = await client.sendBundle(['tx1', 'tx2']);

    expect(result.result).toBe('bundle-id-123');
    expect(mockPost).toHaveBeenCalledWith('/api/v1/bundles', expect.objectContaining({
      method: 'sendBundle',
      params: [['tx1', 'tx2']],
    }));
  });

  test('sendBundle tries fallback regions on failure', async () => {
    // First call fails, fallback succeeds
    mockPost
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce({
        data: { jsonrpc: '2.0', id: 1, result: 'fallback-id' },
      });

    const client = new JitoClient({
      region: 'mainnet',
      fallbackRegions: ['amsterdam', 'frankfurt'],
    });

    const result = await client.sendBundle(['tx1']);
    expect(result.result).toBe('fallback-id');
  });

  test('sendBundle throws when all regions fail', async () => {
    mockPost.mockRejectedValue(new Error('Connection refused'));

    const client = new JitoClient({
      region: 'mainnet',
      fallbackRegions: ['amsterdam'],
    });

    await expect(client.sendBundle(['tx1'])).rejects.toThrow('All Jito regions failed');
  });

  test('getBundleStatus returns status on success', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        result: {
          value: [{
            bundle_id: 'abc',
            confirmation_status: 'confirmed',
            slot: 12345,
          }],
        },
      },
    });

    const client = new JitoClient();
    const status = await client.getBundleStatus('abc');

    expect(status).not.toBeNull();
    expect(status!.status).toBe('Landed');
    expect(status!.landedSlot).toBe(12345);
  });

  test('getBundleStatus returns null on empty response', async () => {
    mockPost.mockResolvedValueOnce({
      data: { result: { value: [] } },
    });

    const client = new JitoClient();
    const status = await client.getBundleStatus('xyz');
    expect(status).toBeNull();
  });

  test('getBundleStatus returns null on error', async () => {
    mockPost.mockRejectedValueOnce(new Error('timeout'));

    const client = new JitoClient();
    const status = await client.getBundleStatus('xyz');
    expect(status).toBeNull();
  });

  test('getBundleStatus maps pending status', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        result: {
          value: [{ bundle_id: 'p1', confirmation_status: 'processed' }],
        },
      },
    });

    const client = new JitoClient();
    const status = await client.getBundleStatus('p1');
    expect(status!.status).toBe('Pending');
  });

  test('getBundleStatus maps failed status', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        result: {
          value: [{
            bundle_id: 'f1',
            confirmation_status: 'failed',
            err: { code: 1 },
          }],
        },
      },
    });

    const client = new JitoClient();
    const status = await client.getBundleStatus('f1');
    expect(status!.status).toBe('Failed');
    expect(status!.error).toBeDefined();
  });

  test('getBundleStatus maps unknown to Invalid', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        result: {
          value: [{ bundle_id: 'u1', confirmation_status: 'wat' }],
        },
      },
    });

    const client = new JitoClient();
    const status = await client.getBundleStatus('u1');
    expect(status!.status).toBe('Invalid');
  });

  test('getTipFloor returns data on success', async () => {
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: [{ landed_tips_50th_percentile: 50000 }],
    });

    const client = new JitoClient();
    const floor = await client.getTipFloor();
    expect(floor.landed_tips_50th_percentile).toBe(50000);
  });

  test('getTipFloor returns defaults on error', async () => {
    (mockedAxios.get as jest.Mock).mockRejectedValueOnce(new Error('offline'));

    const client = new JitoClient();
    const floor = await client.getTipFloor();
    expect(floor.landed_tips_25th_percentile).toBe(1000);
    expect(floor.landed_tips_50th_percentile).toBe(10000);
  });

  test('constructor uses default config', () => {
    const client = new JitoClient();
    expect(client.getRegion()).toBe('mainnet');
    expect(client.getEndpoint()).toBe(JITO_ENDPOINTS.mainnet);
  });

  test('constructor with custom timeout', () => {
    new JitoClient({ timeout: 10000 });
    expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({
      timeout: 10000,
    }));
  });
});
