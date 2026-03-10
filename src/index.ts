export {
  MermaidRepairEngine,
  defaultEngine,
  transformMermaid,
  transformMermaidFull,
} from "./core/engine.js";

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
} from "./types/index.js";

export {
  DIAGRAM_REGISTRY,
  ALIAS_TO_CANONICAL,
  resolveCanonical,
  getEntry,
  isXYChartAlias,
  allAliasesFor,
} from "./core/registry.js";

export { detectIntent, isXYAlias } from "./core/detector.js";

export {
  extractMermaidBlock,
  sanitize,
  normalizeIndentation,
  preprocess,
} from "./core/sanitizer.js";

export {
  isMermaidStreaming,
  hasMermaidBlock,
  getStreamingPartial,
  // Phase 3.2: export StreamingTimeoutTracker สำหรับ custom UI
  StreamingTimeoutTracker,
} from "./core/streaming.js";

export {
  parseLooseXYChart,
  buildXYChart,
  xyChartRebuilderPass,
} from "./rebuilders/xyChartRebuilder.js";

export {
  parseLooseVenn,
  buildVenn,
  vennRebuilderPass,
} from "./rebuilders/vennRebuilder.js";

export {
  parseLoosePie,
  buildPie,
  pieRebuilderPass,
} from "./rebuilders/pieRebuilder.js";

// Phase: Critical Structure Recovery — Capability 7
export {
  parseLooseFlowchart,
  buildFlowchart,
  flowchartRebuilderPass,
} from "./rebuilders/flowchartRebuilder.js";

export {
  parseLooseSequence,
  buildSequence,
  sequenceRebuilderPass,
} from "./rebuilders/sequenceRebuilder.js";

export {
  parseLooseClassDiagram,
  buildClassDiagram,
  classRebuilderPass,
} from "./rebuilders/classRebuilder.js";

export {
  BUILTIN_PASSES,
  // Phase 4: export new passes สำหรับ custom plugin composition
  timelineRepairPass,
  requirementDiagramRepairPass,
  journeyRepairPass,
} from "./plugins/builtins.js";
