import { Keypair } from '@solana/web3.js';
import { TipRotator, TipRotatorConfig, TipSelection } from './tip-rotator';
import { TimingRotator, TimingConfig, TimingDecision } from './timing-rotator';
import { RegionRotator, RegionRotatorConfig, RegionSelection } from './region-rotator';
import { SignerRotator, SignerRotatorConfig, SignerSelection } from './signer-rotator';

export interface PatternEngineConfig {
  readonly tip?: Partial<TipRotatorConfig>;
  readonly timing?: Partial<TimingConfig>;
  readonly region?: Partial<RegionRotatorConfig>;
  readonly signer?: Partial<SignerRotatorConfig>;
}

export interface RotationDecision {
  readonly tip: TipSelection;
  readonly timing: TimingDecision;
  readonly region: RegionSelection;
  readonly signer: SignerSelection;
}

export interface DetectionRiskReport {
  readonly tipRepeatRate: number;
  readonly regionRepeatRate: number;
  readonly signerRepeatRate: number;
  readonly timingVariance: number;
  readonly overallRisk: 'low' | 'medium' | 'high';
  readonly recommendations: string[];
}

/**
 * Orchestrates all four rotators to produce fully randomized bundle parameters.
 *
 * Each call to `next()` returns a complete rotation decision:
 * tip account + amount, timing delay, Jito region, and signing wallet.
 *
 * The `analyzeRisk()` method evaluates the history of decisions
 * and flags detectable patterns.
 */
export class PatternEngine {
  private readonly tipRotator: TipRotator;
  private readonly timingRotator: TimingRotator;
  private readonly regionRotator: RegionRotator;
  private readonly signerRotator: SignerRotator;
  private readonly decisions: RotationDecision[] = [];

  constructor(config: PatternEngineConfig = {}) {
    this.tipRotator = new TipRotator(config.tip);
    this.timingRotator = new TimingRotator(config.timing);
    this.regionRotator = new RegionRotator(config.region);
    this.signerRotator = new SignerRotator(config.signer);
  }

  addSigners(keypairs: Keypair[], labels?: string[]): void {
    this.signerRotator.addSigners(keypairs, labels);
  }

  setCurrentSlot(slot: number): void {
    this.signerRotator.setCurrentSlot(slot);
  }

  next(): RotationDecision {
    const decision: RotationDecision = {
      tip: this.tipRotator.next(),
      timing: this.timingRotator.next(),
      region: this.regionRotator.next(),
      signer: this.signerRotator.next(),
    };

    this.decisions.push(decision);
    return decision;
  }

  async nextWithDelay(): Promise<RotationDecision> {
    const decision = this.next();
    await new Promise(resolve => setTimeout(resolve, decision.timing.delayMs));
    return decision;
  }

  analyzeRisk(): DetectionRiskReport {
    if (this.decisions.length < 2) {
      return {
        tipRepeatRate: 0,
        regionRepeatRate: 0,
        signerRepeatRate: 0,
        timingVariance: 0,
        overallRisk: 'low',
        recommendations: [],
      };
    }

    const tipRepeatRate = this.calculateConsecutiveRepeatRate(
      this.decisions.map(d => d.tip.account.toBase58())
    );
    const regionRepeatRate = this.calculateConsecutiveRepeatRate(
      this.decisions.map(d => d.region.region)
    );
    const signerRepeatRate = this.calculateConsecutiveRepeatRate(
      this.decisions.map(d => d.signer.label)
    );
    const timingVariance = this.calculateTimingVariance();

    const recommendations: string[] = [];

    if (tipRepeatRate > 0.2) {
      recommendations.push('High tip account repeat rate — consider adding more tip accounts');
    }
    if (regionRepeatRate > 0.3) {
      recommendations.push('High region repeat rate — enable more regions');
    }
    if (signerRepeatRate > 0.4) {
      recommendations.push('High signer repeat rate — add more signing wallets');
    }
    if (timingVariance < 100) {
      recommendations.push('Low timing variance — increase delay range for more human-like behavior');
    }

    const riskScore = (tipRepeatRate * 0.3) + (regionRepeatRate * 0.2) +
      (signerRepeatRate * 0.3) + (timingVariance < 200 ? 0.2 : 0);

    let overallRisk: DetectionRiskReport['overallRisk'];
    if (riskScore > 0.5) overallRisk = 'high';
    else if (riskScore > 0.25) overallRisk = 'medium';
    else overallRisk = 'low';

    return {
      tipRepeatRate,
      regionRepeatRate,
      signerRepeatRate,
      timingVariance,
      overallRisk,
      recommendations,
    };
  }

  getDecisionCount(): number {
    return this.decisions.length;
  }

  reset(): void {
    this.tipRotator.reset();
    this.timingRotator.reset();
    this.regionRotator.reset();
    this.signerRotator.reset();
    this.decisions.length = 0;
  }

  private calculateConsecutiveRepeatRate(values: string[]): number {
    if (values.length < 2) return 0;
    let repeats = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] === values[i - 1]) repeats++;
    }
    return repeats / (values.length - 1);
  }

  private calculateTimingVariance(): number {
    const delays = this.decisions.map(d => d.timing.delayMs);
    if (delays.length < 2) return 0;
    const mean = delays.reduce((a, b) => a + b, 0) / delays.length;
    const variance = delays.reduce((sum, d) => sum + (d - mean) ** 2, 0) / delays.length;
    return Math.sqrt(variance);
  }
}
