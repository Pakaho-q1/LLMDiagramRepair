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
  parseLooseRadar,
  buildRadar,
  radarRebuilderPass,
} from "./rebuilders/radarRebuilder.js";

export {
  parseLooseState,
  buildState,
  stateRebuilderPass,
} from "./rebuilders/stateRebuilder.js";
export {
  parseLooseER,
  buildER,
  erRebuilderPass,
} from "./rebuilders/erRebuilder.js";
export {
  parseLooseGantt,
  buildGantt,
  ganttRebuilderPass,
} from "./rebuilders/ganttRebuilder.js";
export {
  parseLooseGitGraph,
  buildGitGraph,
  gitGraphRebuilderPass,
} from "./rebuilders/gitGraphRebuilder.js";
export {
  parseLooseMindmap,
  buildMindmap,
  mindmapRebuilderPass,
} from "./rebuilders/mindmapRebuilder.js";
export {
  parseLooseTimeline,
  buildTimeline,
  timelineRebuilderPass,
} from "./rebuilders/timelineRebuilder.js";
export {
  parseLooseSankey,
  buildSankey,
  sankeyRebuilderPass,
} from "./rebuilders/sankeyRebuilder.js";
export {
  parseLooseQuadrant,
  buildQuadrant,
  quadrantRebuilderPass,
} from "./rebuilders/quadrantRebuilder.js";
export {
  parseLooseJourney,
  buildJourney,
  journeyRebuilderPass,
} from "./rebuilders/journeyRebuilder.js";
export {
  parseLooseKanban,
  buildKanban,
  kanbanRebuilderPass,
} from "./rebuilders/kanbanRebuilder.js";
export {
  parseLooseTreemap,
  buildTreemap,
  treemapRebuilderPass,
} from "./rebuilders/treemapRebuilder.js";
export {
  parseLooseArchitecture,
  buildArchitecture,
  architectureRebuilderPass,
} from "./rebuilders/architectureRebuilder.js";
export {
  parseLooseRequirement,
  buildRequirement,
  requirementRebuilderPass,
} from "./rebuilders/requirementRebuilder.js";

export {
  BUILTIN_PASSES,
  timelineRepairPass,
  requirementDiagramRepairPass,
  journeyRepairPass,
} from "./plugins/builtins.js";
