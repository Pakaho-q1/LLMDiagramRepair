// ============================================================
// types/index.ts — Core Type Definitions
// LLM-aware Mermaid Repair Engine
// ============================================================

// ─────────────────────────────────────────────
// Diagram Registry
// ─────────────────────────────────────────────

export type DiagramKind =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'stateDiagram-v2'
  | 'erDiagram'
  | 'journey'
  | 'gantt'
  | 'pie'
  | 'quadrantChart'
  | 'requirementDiagram'
  | 'gitGraph'
  | 'C4Context'
  | 'mindmap'
  | 'timeline'
  | 'zenuml'
  | 'sankey-beta'
  | 'xychart-beta'
  | 'block-beta'
  | 'packet-beta'
  | 'kanban'
  | 'architecture-beta'
  | 'radar-beta'
  | 'treemap-beta'
  | 'venn-beta'
  | 'unknown';

export interface DiagramTypeEntry {
  keyword: string; // canonical Mermaid keyword
  aliases: string[]; // aliases (LLM variants, old syntax, etc.)
  betaSuffix?: boolean; // requires -beta suffix
}

// ─────────────────────────────────────────────
// Detection
// ─────────────────────────────────────────────

export interface DetectionResult {
  kind: DiagramKind;
  canonical: string;
  confidence: 'high' | 'medium' | 'low';
  matchedAlias?: string; // alias ที่ตรง (ถ้าไม่ใช่ canonical)
  firstLine: string;
  lineIndex: number;
}

// ─────────────────────────────────────────────
// Repair Pass
// ─────────────────────────────────────────────

export interface RepairPass {
  /** ชื่อ pass (ใช้ใน trace log) */
  name: string;
  /** diagram ที่ pass นี้รองรับ — undefined = รันทุก diagram */
  appliesTo?: DiagramKind[];
  /** true = pass นี้ทำ deterministic rebuild (ไม่แค่ patch) */
  isRebuilder?: boolean;
  /** ฟังก์ชัน repair หลัก */
  repair(ctx: RepairContext): RepairResult;
}

export interface RepairContext {
  code: string;
  detection: DetectionResult | null;
  options: EngineOptions;
  /** ผลจาก pass ก่อนหน้าทั้งหมด (immutable) */
  previousResults: ReadonlyArray<RepairResult>;
}

export interface RepairResult {
  passName: string;
  changed: boolean;
  code: string;
  /** คำอธิบายสิ่งที่แก้ไข (สำหรับ debug / trace) */
  repairs: string[];
}

// ─────────────────────────────────────────────
// Engine Output
// ─────────────────────────────────────────────

export interface TransformResult {
  /** โค้ดที่พร้อม render */
  code: string;
  /** diagram ที่ตรวจพบ */
  detection: DetectionResult | null;
  /** รายการ repair ทั้งหมดที่เกิดขึ้น */
  repairs: string[];
  /** จำนวน pass ที่วิ่ง */
  passCount: number;
  /** true = มีการเปลี่ยนแปลงจาก input เดิม */
  wasRepaired: boolean;
  /** สำหรับ debug: trace ทุก pass */
  trace?: RepairResult[];
}

// ─────────────────────────────────────────────
// Engine Options
// ─────────────────────────────────────────────

export interface EngineOptions {
  /**
   * จำนวน pass สูงสุดในการ repair ซ้ำ
   * @default 5
   */
  maxPasses?: number;

  /**
   * เปิด trace log ทุก pass (ใช้สำหรับ debug)
   * @default false
   */
  trace?: boolean;

  /**
   * Custom plugins เพิ่มเติม (prepend ก่อน built-in หรือ append ท้าย)
   */
  plugins?: PluginRegistration[];

  /**
   * Disable built-in passes โดยชื่อ
   */
  disablePasses?: string[];
}

// ─────────────────────────────────────────────
// Plugin System
// ─────────────────────────────────────────────

export interface PluginRegistration {
  pass: RepairPass;
  /** 'prepend' = วิ่งก่อน built-in, 'append' = วิ่งหลัง built-in */
  position?: 'prepend' | 'append';
  /** แทรกก่อน pass ชื่อนี้ (ถ้าไม่ระบุ position) */
  before?: string;
  /** แทรกหลัง pass ชื่อนี้ */
  after?: string;
}

export type Plugin = (options?: Record<string, unknown>) => PluginRegistration;
