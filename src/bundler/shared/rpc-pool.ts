import { Connection } from '@solana/web3.js';

/** Configuration for a single RPC endpoint */
export interface RpcEndpoint {
  url: string;
  weight: number;
  label?: string;
  rateLimit?: number;
}

/** RPC pool selection strategy */
export type RpcStrategy = 'round-robin' | 'fastest' | 'weighted-random' | 'failover';

/** Configuration for the RPC connection pool */
export interface RpcPoolConfig {
  endpoints: RpcEndpoint[];
  strategy: RpcStrategy;
  healthCheckIntervalMs: number;
  timeoutMs: number;
  maxRetries: number;
}

/** Latency measurement for an endpoint */
interface EndpointHealth {
  url: string;
  label: string;
  latencyMs: number;
  alive: boolean;
  lastCheck: number;
  errorCount: number;
}

/**
 * Pool of RPC connections with failover, health checks, and load balancing.
 * Critical for trading bots that cannot depend on a single RPC node.
 */
export class RpcPool {
  private readonly config: RpcPoolConfig;
  private readonly connections: Map<string, Connection> = new Map();
  private readonly health: Map<string, EndpointHealth> = new Map();
  private roundRobinIndex = 0;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RpcPoolConfig) {
    if (config.endpoints.length === 0) {
      throw new Error('RpcPool requires at least one endpoint');
    }
    this.config = config;

    for (const ep of config.endpoints) {
      this.connections.set(ep.url, new Connection(ep.url, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: config.timeoutMs,
      }));
      this.health.set(ep.url, {
        url: ep.url,
        label: ep.label || ep.url,
        latencyMs: Infinity,
        alive: true,
        lastCheck: 0,
        errorCount: 0,
      });
    }
  }

  /** Start periodic health checks */
  startHealthChecks(): void {
    if (this.healthCheckTimer) return;
    this.runHealthCheck();
    this.healthCheckTimer = setInterval(
      () => this.runHealthCheck(),
      this.config.healthCheckIntervalMs
    );
  }

  /** Stop health checks */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /** Get a connection using the configured strategy */
  getConnection(): Connection {
    switch (this.config.strategy) {
      case 'round-robin':
        return this.getRoundRobin();
      case 'fastest':
        return this.getFastestConnection();
      case 'weighted-random':
        return this.getWeightedRandom();
      case 'failover':
        return this.getFailover();
      default:
        return this.getFailover();
    }
  }

  /** Get the connection with lowest measured latency */
  getFastestConnection(): Connection {
    let bestUrl = this.config.endpoints[0].url;
    let bestLatency = Infinity;

    for (const [url, h] of this.health) {
      if (h.alive && h.latencyMs < bestLatency) {
        bestLatency = h.latencyMs;
        bestUrl = url;
      }
    }

    return this.connections.get(bestUrl)!;
  }

  /** Broadcast a raw transaction to all alive endpoints for maximum landing probability */
  async broadcastToAll(rawTransaction: Buffer): Promise<string[]> {
    const alive = this.getAliveEndpoints();
    const results: string[] = [];

    const promises = alive.map(async (url) => {
      const conn = this.connections.get(url)!;
      try {
        const sig = await conn.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
          maxRetries: 0,
        });
        results.push(sig);
        return sig;
      } catch {
        return null;
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /** Get latency statistics for all endpoints */
  getLatencyStats(): Map<string, number> {
    const stats = new Map<string, number>();
    for (const [_url, h] of this.health) {
      stats.set(h.label, h.alive ? h.latencyMs : -1);
    }
    return stats;
  }

  /** Mark an endpoint as failed */
  markFailed(url: string): void {
    const h = this.health.get(url);
    if (h) {
      h.errorCount++;
      if (h.errorCount >= 3) {
        h.alive = false;
      }
    }
  }

  /** Get all alive endpoint URLs */
  private getAliveEndpoints(): string[] {
    const alive: string[] = [];
    for (const [url, h] of this.health) {
      if (h.alive) alive.push(url);
    }
    // If none alive, return all (last resort)
    return alive.length > 0 ? alive : this.config.endpoints.map(e => e.url);
  }

  private getRoundRobin(): Connection {
    const alive = this.getAliveEndpoints();
    const url = alive[this.roundRobinIndex % alive.length];
    this.roundRobinIndex++;
    return this.connections.get(url)!;
  }

  private getWeightedRandom(): Connection {
    const alive = this.getAliveEndpoints();
    const endpoints = this.config.endpoints.filter(e => alive.includes(e.url));
    const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;

    for (const ep of endpoints) {
      random -= ep.weight;
      if (random <= 0) {
        return this.connections.get(ep.url)!;
      }
    }

    return this.connections.get(endpoints[0].url)!;
  }

  private getFailover(): Connection {
    for (const ep of this.config.endpoints) {
      const h = this.health.get(ep.url)!;
      if (h.alive) {
        return this.connections.get(ep.url)!;
      }
    }
    // All down: return first
    return this.connections.get(this.config.endpoints[0].url)!;
  }

  private async runHealthCheck(): Promise<void> {
    for (const ep of this.config.endpoints) {
      const h = this.health.get(ep.url)!;
      const start = Date.now();
      try {
        const conn = this.connections.get(ep.url)!;
        await conn.getSlot();
        h.latencyMs = Date.now() - start;
        h.alive = true;
        h.errorCount = 0;
      } catch {
        h.latencyMs = Infinity;
        h.errorCount++;
        if (h.errorCount >= 3) {
          h.alive = false;
        }
      }
      h.lastCheck = Date.now();
    }
  }
}
