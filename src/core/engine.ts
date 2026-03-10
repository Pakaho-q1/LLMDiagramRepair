import type {
  EngineOptions,
  TransformResult,
  RepairPass,
  RepairContext,
  RepairResult,
  PluginRegistration,
} from "../types/index.js";
import { preprocess } from "./sanitizer.js";
import { detectIntent } from "./detector.js";
import { BUILTIN_PASSES } from "../plugins/builtins.js";
import { xyChartRebuilderPass } from "../rebuilders/xyChartRebuilder.js";
import { vennRebuilderPass } from "../rebuilders/vennRebuilder.js";
import { pieRebuilderPass } from "../rebuilders/pieRebuilder.js";
import { flowchartRebuilderPass } from "../rebuilders/flowchartRebuilder.js";
import { sequenceRebuilderPass } from "../rebuilders/sequenceRebuilder.js";
import { classRebuilderPass } from "../rebuilders/classRebuilder.js";
import { radarRebuilderPass } from "../rebuilders/radarRebuilder.js";
import { stateRebuilderPass } from "../rebuilders/stateRebuilder.js";
import { erRebuilderPass } from "../rebuilders/erRebuilder.js";
import { ganttRebuilderPass } from "../rebuilders/ganttRebuilder.js";
import { gitGraphRebuilderPass } from "../rebuilders/gitGraphRebuilder.js";
import { mindmapRebuilderPass } from "../rebuilders/mindmapRebuilder.js";
import { timelineRebuilderPass } from "../rebuilders/timelineRebuilder.js";
import { sankeyRebuilderPass } from "../rebuilders/sankeyRebuilder.js";
import { quadrantRebuilderPass } from "../rebuilders/quadrantRebuilder.js";
import { journeyRebuilderPass } from "../rebuilders/journeyRebuilder.js";
import { kanbanRebuilderPass } from "../rebuilders/kanbanRebuilder.js";
import { treemapRebuilderPass } from "../rebuilders/treemapRebuilder.js";
import { architectureRebuilderPass } from "../rebuilders/architectureRebuilder.js";
import { requirementRebuilderPass } from "../rebuilders/requirementRebuilder.js";

const DEFAULT_OPTIONS: Required<
  Omit<EngineOptions, "plugins" | "disablePasses">
> = {
  maxPasses: 5,
  trace: false,
};

// ─────────────────────────────────────────────
// Rebuilder passes แยกออกมาชัดเจน
// เรียงตาม priority: diagram ที่ซับซ้อนและ LLM สร้างผิดบ่อย → ก่อน
// ─────────────────────────────────────────────
const REBUILDER_PASSES: RepairPass[] = [
  // Critical Structure Recovery — complex diagrams first
  flowchartRebuilderPass as RepairPass,
  sequenceRebuilderPass as RepairPass,
  classRebuilderPass as RepairPass,
  stateRebuilderPass as RepairPass,
  erRebuilderPass as RepairPass,
  // Data visualization
  xyChartRebuilderPass as RepairPass,
  radarRebuilderPass as RepairPass,
  pieRebuilderPass as RepairPass,
  vennRebuilderPass as RepairPass,
  sankeyRebuilderPass as RepairPass,
  quadrantRebuilderPass as RepairPass,
  treemapRebuilderPass as RepairPass,
  // Process / time-based
  ganttRebuilderPass as RepairPass,
  gitGraphRebuilderPass as RepairPass,
  mindmapRebuilderPass as RepairPass,
  timelineRebuilderPass as RepairPass,
  journeyRebuilderPass as RepairPass,
  // Infra / structured
  architectureRebuilderPass as RepairPass,
  kanbanRebuilderPass as RepairPass,
  requirementRebuilderPass as RepairPass,
];

export class MermaidRepairEngine {
  private readonly options: Required<
    Omit<EngineOptions, "plugins" | "disablePasses">
  > &
    Pick<EngineOptions, "plugins" | "disablePasses">;

  private readonly rebuilderPasses: RepairPass[];
  private readonly cleanupPasses: RepairPass[];

  constructor(options: EngineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    const { rebuilders, cleanup } = this.buildPassPipeline(options);
    this.rebuilderPasses = rebuilders;
    this.cleanupPasses = cleanup;
  }

  transform(raw: string): TransformResult {
    const preprocessed = preprocess(raw);
    const detection = detectIntent(preprocessed);

    // Phase 5.2: ถ้า confidence ต่ำมาก ให้ warn และข้าม destructive passes
    const isLowConfidence = detection?.confidence === "low";

    const allRepairs: string[] = [];
    const trace: RepairResult[] = [];
    let code = preprocessed;
    let totalPasses = 0;
    let wasRebuilt = false;

    // ── Phase 2.1: วิ่ง Rebuilder passes ก่อนเสมอ ────────────────
    // ถ้า rebuilder เปลี่ยน code → mark rebuilt แล้ววิ่ง cleanup passes
    // ถ้าไม่มีอะไรเปลี่ยน → วิ่ง cleanup passes ปกติ
    const activeRebuilders = this.selectPasses(
      detection?.canonical,
      this.rebuilderPasses,
    );

    for (const pass of activeRebuilders) {
      const ctx: RepairContext = {
        code,
        detection,
        options: this.options,
        previousResults: trace,
      };

      const result = pass.repair(ctx);
      totalPasses++;

      if (result.changed) {
        code = result.code;
        allRepairs.push(...result.repairs);
        wasRebuilt = true;

        if (this.options.trace) trace.push(result);

        // Phase 2.1: rebuilder เปลี่ยน code แล้ว → หยุด rebuilder passes อื่น
        // ไม่ให้ double-rebuild
        break;
      }

      if (this.options.trace) trace.push(result);
    }

    // ── Phase 2.2: วิ่ง Cleanup (builtin) passes ────────────────
    // ถ้า rebuilt แล้ว → วิ่งเพียง 1 รอบเพื่อ normalize syntax
    // ถ้าไม่ได้ rebuilt → วิ่งซ้ำได้ถึง maxPasses
    const activeCleanup = this.selectPasses(
      detection?.canonical,
      this.cleanupPasses,
      isLowConfidence,
    );

    const maxIterations = wasRebuilt ? 1 : this.options.maxPasses;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let changed = false;

      for (const pass of activeCleanup) {
        const ctx: RepairContext = {
          code,
          detection,
          options: this.options,
          previousResults: trace,
        };

        const result = pass.repair(ctx);
        totalPasses++;

        if (result.changed) {
          code = result.code;
          allRepairs.push(...result.repairs);
          changed = true;
        }

        if (this.options.trace) trace.push(result);
      }

      if (!changed) break;
    }

    return {
      code,
      detection,
      repairs: allRepairs,
      passCount: totalPasses,
      wasRepaired: allRepairs.length > 0,
      trace: this.options.trace ? trace : undefined,
    };
  }

  use(registration: PluginRegistration): MermaidRepairEngine {
    return new MermaidRepairEngine({
      ...this.options,
      plugins: [...(this.options.plugins ?? []), registration],
    });
  }

  private buildPassPipeline(options: EngineOptions): {
    rebuilders: RepairPass[];
    cleanup: RepairPass[];
  } {
    const disabled = new Set(options.disablePasses ?? []);

    const baseRebuilders = REBUILDER_PASSES.filter(
      (p) => !disabled.has(p.name),
    );
    const baseCleanup = BUILTIN_PASSES.filter((p) => !disabled.has(p.name));

    if (!options.plugins?.length) {
      return { rebuilders: baseRebuilders, cleanup: baseCleanup };
    }

    const rebuilderPipeline = [...baseRebuilders];
    const cleanupPipeline = [...baseCleanup];

    for (const reg of options.plugins) {
      const targetPipeline = reg.pass.isRebuilder
        ? rebuilderPipeline
        : cleanupPipeline;

      if (reg.position === "prepend") {
        targetPipeline.unshift(reg.pass);
      } else if (reg.position === "append") {
        targetPipeline.push(reg.pass);
      } else if (reg.before) {
        const idx = targetPipeline.findIndex((p) => p.name === reg.before);
        targetPipeline.splice(idx >= 0 ? idx : 0, 0, reg.pass);
      } else if (reg.after) {
        const idx = targetPipeline.findIndex((p) => p.name === reg.after);
        targetPipeline.splice(
          idx >= 0 ? idx + 1 : targetPipeline.length,
          0,
          reg.pass,
        );
      } else {
        targetPipeline.push(reg.pass);
      }
    }

    return {
      rebuilders: rebuilderPipeline.filter((p) => !disabled.has(p.name)),
      cleanup: cleanupPipeline.filter((p) => !disabled.has(p.name)),
    };
  }

  private selectPasses(
    canonical: string | undefined,
    passes: RepairPass[],
    isLowConfidence = false,
  ): RepairPass[] {
    let selected = passes;

    if (canonical) {
      selected = selected.filter(
        (p) => !p.appliesTo || p.appliesTo.includes(canonical as any),
      );
    }

    if (isLowConfidence) {
      const SAFE_PASS_NAMES = new Set(["keyword-normalization", "beta-suffix"]);
      selected = selected.filter((p) => SAFE_PASS_NAMES.has(p.name));
    }

    return selected;
  }
}

export const defaultEngine = new MermaidRepairEngine();

export function transformMermaid(raw: string): string {
  return defaultEngine.transform(raw).code;
}

export function transformMermaidFull(
  raw: string,
  options?: EngineOptions,
): TransformResult {
  const engine = options ? new MermaidRepairEngine(options) : defaultEngine;
  return engine.transform(raw);
}
