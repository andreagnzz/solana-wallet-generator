// ─── Shared Infrastructure ──────────────────────────────────────
export { RpcPool, RpcPoolConfig, RpcEndpoint, RpcStrategy } from './shared/rpc-pool';
export {
  getOptimalPriorityFee,
  addPriorityFeeInstructions,
  PriorityFeeConfig,
  PriorityFeeResult,
} from './shared/priority-fee';
export { TxBuilder, SimulationResult } from './shared/tx-builder';
export {
  withRetry,
  sendWithRetry,
  classifySolanaError,
  SolanaErrorType,
  RetryOptions,
} from './shared/retry';
export {
  simulateTransaction,
  simulateBundle as simulateBundleTxs,
  isSimulationSafe,
  DetailedSimulation,
} from './shared/simulation';

// ─── Jito Bundle ────────────────────────────────────────────────
export {
  JitoClient,
  JitoClientConfig,
  JitoRegion,
  JITO_ENDPOINTS,
  JITO_TIP_ACCOUNTS,
  getRandomTipAccount,
} from './jito/jito-client';
export {
  calculateTip,
  TipStrategy,
  TipResult,
  tipToSol,
  formatTipInfo,
} from './jito/jito-tip';
export {
  buildJitoBundle,
  buildSimpleBundle,
  sendBundle,
  JitoBundleConfig,
  JitoBundle,
  BundleSendResult,
} from './jito/jito-bundle';
export {
  monitorBundle,
  monitorBundles,
  BundleMonitorResult,
  BundleMonitorStatus,
  MonitorOptions,
} from './jito/jito-monitor';

// ─── Sweep ──────────────────────────────────────────────────────
export {
  executeSweep,
  SweepConfig,
  SweepResult,
  SweepTxResult,
} from './sweep/sweep-engine';
export {
  estimateSweep,
  formatSweepEstimate,
  SweepEstimate,
  SweepEstimateConfig,
  WalletSweepPreview,
} from './sweep/sweep-estimator';
export { SweepScheduler, SweepTrigger } from './sweep/sweep-scheduler';

// ─── Distribute ─────────────────────────────────────────────────
export {
  executeDistribute,
  DistributeConfig,
  DistributeResult,
  DistributeTxResult,
} from './distribute/distribute-engine';
export {
  calculateDistribution,
  getTotalRequired,
  DistributeTarget,
  DistributeStrategy,
  DistributionAllocation,
} from './distribute/distribute-strategy';
export {
  validateDistribution,
  ValidationResult,
} from './distribute/distribute-validator';

// ─── Keystore Bundle ────────────────────────────────────────────
export {
  packWallets,
  addWalletToBundle,
  removeWalletFromBundle,
  mergeBundles,
  BundlePackConfig,
} from './keystore/bundle-pack';
export {
  unpackBundle,
  listBundle,
  bundleInfo,
  BundleUnpackConfig,
  UnpackResult,
} from './keystore/bundle-unpack';
export {
  BundleIndex,
  BundleIndexEntry,
  BundleMetadata,
  WalletBundleFile,
  BundleWalletData,
  buildBundleIndex,
  filterIndex,
} from './keystore/bundle-index';

// ─── Rotation ──────────────────────────────────────────────────
export {
  TipRotator,
  TipRotatorConfig,
  TipSelection,
} from './rotation/tip-rotator';
export {
  TimingRotator,
  TimingConfig,
  TimingDecision,
} from './rotation/timing-rotator';
export {
  RegionRotator,
  RegionRotatorConfig,
  RegionSelection,
  RegionStats,
} from './rotation/region-rotator';
export {
  SignerRotator,
  SignerRotatorConfig,
  SignerSelection,
} from './rotation/signer-rotator';
export {
  PatternEngine,
  PatternEngineConfig,
  RotationDecision,
  DetectionRiskReport,
} from './rotation/pattern-engine';

// ─── Multi-Bundle Sequencer ────────────────────────────────────
export {
  BatchBuilder,
  BatchItem,
  BatchConfig,
} from './multi-bundle/batch-builder';
export {
  BatchMonitor,
  BatchBundleStatus,
  BatchBundleEntry,
  BatchMonitorSummary,
} from './multi-bundle/batch-monitor';
export {
  BundleSequencer,
  SequencerMode,
  SequencerConfig,
  SequencerResult,
} from './multi-bundle/sequencer';
export {
  buildReport,
  formatReportText,
  BatchReport,
  BatchReportItem,
} from './multi-bundle/batch-reporter';
