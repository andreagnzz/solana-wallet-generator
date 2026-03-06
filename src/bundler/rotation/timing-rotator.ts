import crypto from 'crypto';

export interface TimingConfig {
  readonly minDelayMs: number;
  readonly maxDelayMs: number;
  readonly burstProbability: number;
  readonly burstMinDelayMs: number;
  readonly burstMaxDelayMs: number;
  readonly pauseProbability: number;
  readonly pauseMinMs: number;
  readonly pauseMaxMs: number;
}

export interface TimingDecision {
  readonly delayMs: number;
  readonly isBurst: boolean;
  readonly isPause: boolean;
}

const DEFAULT_TIMING: TimingConfig = {
  minDelayMs: 800,
  maxDelayMs: 3000,
  burstProbability: 0.15,
  burstMinDelayMs: 100,
  burstMaxDelayMs: 400,
  pauseProbability: 0.10,
  pauseMinMs: 5000,
  pauseMaxMs: 15000,
};

/**
 * Generates human-like timing delays between bundle submissions.
 *
 * Simulates natural behavior:
 * - Normal delays: typical human reaction time range
 * - Bursts: occasional rapid-fire submissions (like a human clicking fast)
 * - Pauses: occasional longer breaks (like a human thinking)
 *
 * Uses crypto.randomBytes for non-predictable randomness.
 */
export class TimingRotator {
  private readonly config: TimingConfig;
  private burstCounter = 0;
  private readonly maxBurstLength = 4;
  private readonly history: TimingDecision[] = [];

  constructor(config: Partial<TimingConfig> = {}) {
    this.config = { ...DEFAULT_TIMING, ...config };

    if (this.config.burstProbability + this.config.pauseProbability > 1) {
      throw new Error('burstProbability + pauseProbability must be <= 1');
    }
  }

  next(): TimingDecision {
    const roll = this.cryptoRandomFloat();

    let decision: TimingDecision;

    if (this.burstCounter > 0) {
      this.burstCounter--;
      decision = {
        delayMs: this.randomInRange(this.config.burstMinDelayMs, this.config.burstMaxDelayMs),
        isBurst: true,
        isPause: false,
      };
    } else if (roll < this.config.burstProbability) {
      this.burstCounter = this.cryptoRandomInt(this.maxBurstLength);
      decision = {
        delayMs: this.randomInRange(this.config.burstMinDelayMs, this.config.burstMaxDelayMs),
        isBurst: true,
        isPause: false,
      };
    } else if (roll < this.config.burstProbability + this.config.pauseProbability) {
      decision = {
        delayMs: this.randomInRange(this.config.pauseMinMs, this.config.pauseMaxMs),
        isBurst: false,
        isPause: true,
      };
    } else {
      decision = {
        delayMs: this.randomInRange(this.config.minDelayMs, this.config.maxDelayMs),
        isBurst: false,
        isPause: false,
      };
    }

    this.history.push(decision);
    return decision;
  }

  async wait(): Promise<TimingDecision> {
    const decision = this.next();
    await new Promise(resolve => setTimeout(resolve, decision.delayMs));
    return decision;
  }

  getHistory(): readonly TimingDecision[] {
    return this.history;
  }

  getStats(): { avgDelayMs: number; burstCount: number; pauseCount: number; normalCount: number } {
    if (this.history.length === 0) {
      return { avgDelayMs: 0, burstCount: 0, pauseCount: 0, normalCount: 0 };
    }

    let total = 0;
    let burstCount = 0;
    let pauseCount = 0;
    let normalCount = 0;

    for (const d of this.history) {
      total += d.delayMs;
      if (d.isBurst) burstCount++;
      else if (d.isPause) pauseCount++;
      else normalCount++;
    }

    return {
      avgDelayMs: Math.round(total / this.history.length),
      burstCount,
      pauseCount,
      normalCount,
    };
  }

  reset(): void {
    this.burstCounter = 0;
    this.history.length = 0;
  }

  private randomInRange(min: number, max: number): number {
    const range = max - min;
    if (range === 0) return min;
    return min + this.cryptoRandomInt(range + 1);
  }

  private cryptoRandomInt(max: number): number {
    const bytes = crypto.randomBytes(4);
    return bytes.readUInt32BE(0) % max;
  }

  private cryptoRandomFloat(): number {
    const bytes = crypto.randomBytes(4);
    return bytes.readUInt32BE(0) / 0xFFFFFFFF;
  }
}
