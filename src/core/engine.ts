import type {
  EngineOptions,
  TransformResult,
  RepairPass,
  RepairContext,
  RepairResult,
  PluginRegistration,
} from '../types/index.js';
import { preprocess } from './sanitizer.js';
import { detectIntent } from './detector.js';
import { BUILTIN_PASSES } from '../plugins/builtins.js';
import { xyChartRebuilderPass } from '../rebuilders/xyChartRebuilder.js';
import { vennRebuilderPass } from '../rebuilders/vennRebuilder.js';
import { pieRebuilderPass } from '../rebuilders/pieRebuilder.js';

const DEFAULT_OPTIONS: Required<
  Omit<EngineOptions, 'plugins' | 'disablePasses'>
> = {
  maxPasses: 5,
  trace: false,
};

const REBUILDER_PASSES: RepairPass[] = [
  xyChartRebuilderPass as RepairPass,
  vennRebuilderPass as RepairPass,
  pieRebuilderPass as RepairPass,
];

export class MermaidRepairEngine {
  private readonly options: Required<
    Omit<EngineOptions, 'plugins' | 'disablePasses'>
  > &
    Pick<EngineOptions, 'plugins' | 'disablePasses'>;

  private readonly passes: RepairPass[];

  constructor(options: EngineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.passes = this.buildPassPipeline(options);
  }
  transform(raw: string): TransformResult {
    const preprocessed = preprocess(raw);

    const detection = detectIntent(preprocessed);

    const activePasses = this.selectPasses(detection?.canonical);

    const allRepairs: string[] = [];
    const trace: RepairResult[] = [];
    let code = preprocessed;
    let totalPasses = 0;

    for (let iteration = 0; iteration < this.options.maxPasses; iteration++) {
      let changed = false;

      for (const pass of activePasses) {
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

        if (this.options.trace) {
          trace.push(result);
        }
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

  private buildPassPipeline(options: EngineOptions): RepairPass[] {
    const disabled = new Set(options.disablePasses ?? []);

    const base: RepairPass[] = [...REBUILDER_PASSES, ...BUILTIN_PASSES].filter(
      (p) => !disabled.has(p.name),
    );

    if (!options.plugins?.length) return base;

    const pipeline = [...base];

    for (const reg of options.plugins) {
      if (reg.position === 'prepend') {
        pipeline.unshift(reg.pass);
      } else if (reg.position === 'append') {
        pipeline.push(reg.pass);
      } else if (reg.before) {
        const idx = pipeline.findIndex((p) => p.name === reg.before);
        pipeline.splice(idx >= 0 ? idx : 0, 0, reg.pass);
      } else if (reg.after) {
        const idx = pipeline.findIndex((p) => p.name === reg.after);
        pipeline.splice(idx >= 0 ? idx + 1 : pipeline.length, 0, reg.pass);
      } else {
        pipeline.push(reg.pass);
      }
    }

    return pipeline.filter((p) => !disabled.has(p.name));
  }

  private selectPasses(canonical?: string): RepairPass[] {
    if (!canonical) return this.passes;

    return this.passes.filter(
      (p) => !p.appliesTo || p.appliesTo.includes(canonical as any),
    );
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
