export {
  MermaidRepairEngine,
  defaultEngine,
  transformMermaid,
  transformMermaidFull,
} from './core/engine.js';

export type {
  DiagramKind,
  DiagramTypeEntry,
  DetectionResult,
  RepairPass,
  RepairContext,
  RepairResult,
  TransformResult,
  EngineOptions,
  PluginRegistration,
  Plugin,
} from './types/index.js';

export {
  DIAGRAM_REGISTRY,
  ALIAS_TO_CANONICAL,
  resolveCanonical,
  getEntry,
  isXYChartAlias,
  allAliasesFor,
} from './core/registry.js';

export { detectIntent, isXYAlias } from './core/detector.js';

export {
  extractMermaidBlock,
  sanitize,
  normalizeIndentation,
  preprocess,
} from './core/sanitizer.js';

export { isMermaidStreaming, hasMermaidBlock } from './core/streaming.js';

export {
  parseLooseXYChart,
  buildXYChart,
  xyChartRebuilderPass,
} from './rebuilders/xyChartRebuilder.js';

export {
  parseLooseVenn,
  buildVenn,
  vennRebuilderPass,
} from './rebuilders/vennRebuilder.js';

export {
  parseLoosePie,
  buildPie,
  pieRebuilderPass,
} from './rebuilders/pieRebuilder.js';

export { BUILTIN_PASSES } from './plugins/builtins.js';
