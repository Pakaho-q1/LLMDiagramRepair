export type DiagramKind =
  | "flowchart"
  | "sequenceDiagram"
  | "classDiagram"
  | "stateDiagram-v2"
  | "erDiagram"
  | "journey"
  | "gantt"
  | "pie"
  | "quadrantChart"
  | "requirementDiagram"
  | "gitGraph"
  | "C4Context"
  | "mindmap"
  | "timeline"
  | "zenuml"
  | "sankey-beta"
  | "xychart-beta"
  | "block-beta"
  | "packet-beta"
  | "kanban"
  | "architecture-beta"
  | "radar-beta"
  | "treemap-beta"
  | "venn-beta"
  | "unknown";

export interface DiagramTypeEntry {
  keyword: string;
  aliases: string[];
  betaSuffix?: boolean;
}

export interface DetectionResult {
  kind: DiagramKind;
  canonical: string;
  confidence: "high" | "medium" | "low";
  matchedAlias?: string;
  firstLine: string;
  lineIndex: number;
}

export interface RepairPass {
  name: string;
  appliesTo?: DiagramKind[];
  isRebuilder?: boolean;
  repair(ctx: RepairContext): RepairResult;
}

export interface RepairContext {
  code: string;
  detection: DetectionResult | null;
  options: EngineOptions;
  previousResults: ReadonlyArray<RepairResult>;
}

export interface RepairResult {
  passName: string;
  changed: boolean;
  code: string;
  repairs: string[];
}

export interface TransformResult {
  code: string;
  detection: DetectionResult | null;
  repairs: string[];
  passCount: number;
  wasRepaired: boolean;
  trace?: RepairResult[];
}

export interface EngineOptions {
  /**
   * Maximum number of passes to repeat repair
   * @default 5
   */
  maxPasses?: number;

  /**
   * Open trace log every pass (used for debugging)
   * @default false
   */
  trace?: boolean;

  /**
   * Additional custom plugins (prepend before built-in or append after)
   */
  plugins?: PluginRegistration[];

  /**
   * Disable built-in passes by name
   */
  disablePasses?: string[];
}

export interface PluginRegistration {
  pass: RepairPass;
  /**'prepend' = run before built-in, 'append' = run after built-in */
  position?: "prepend" | "append";
  /**Insert before pass this name (if position is not specified) */
  before?: string;
  /** Insert after pass this name */
  after?: string;
}

export type Plugin = (options?: Record<string, unknown>) => PluginRegistration;
