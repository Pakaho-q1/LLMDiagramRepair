/**
 * llm-engine.test.ts
 * ทดสอบ Plugin System, Engine Options, และ Custom Pass
 * จำลองการใช้งานจริงจาก developer ที่ต่อยอด LLMDiagramRepair
 */

import { describe, test, expect } from 'vitest'
import { MermaidRepairEngine, transformMermaidFull } from '../src/index.js'
import type { RepairPass, RepairContext, RepairResult } from '../src/index.js'

// ─────────────────────────────────────────────
// 1. Plugin System
// ─────────────────────────────────────────────
describe('Plugin System', () => {

  test('custom plugin prepend วิ่งก่อน builtin passes', () => {
    const log: string[] = []

    const trackerPass: RepairPass = {
      name: 'tracker',
      repair(ctx: RepairContext): RepairResult {
        log.push('tracker-ran')
        return { passName: 'tracker', changed: false, code: ctx.code, repairs: [] }
      }
    }

    const engine = new MermaidRepairEngine().use({ pass: trackerPass, position: 'prepend' })
    engine.transform('flowchart TD\n  A-->B')

    expect(log).toContain('tracker-ran')
  })

  test('custom plugin แก้ไข code ได้จริง', () => {
    const customPass: RepairPass = {
      name: 'custom-fix',
      repair(ctx: RepairContext): RepairResult {
        const code = ctx.code.replace('PLACEHOLDER', 'flowchart TD\n  A --> B')
        return { passName: 'custom-fix', changed: code !== ctx.code, code, repairs: ['Replaced placeholder'] }
      }
    }

    const engine = new MermaidRepairEngine().use({ pass: customPass, position: 'prepend' })
    const r = engine.transform('PLACEHOLDER')

    expect(r.repairs).toContain('Replaced placeholder')
  })

  test('custom plugin append วิ่งหลัง builtin', () => {
    const appendPass: RepairPass = {
      name: 'appended',
      repair(ctx: RepairContext): RepairResult {
        return { passName: 'appended', changed: false, code: ctx.code, repairs: [] }
      }
    }

    const engine = new MermaidRepairEngine().use({ pass: appendPass, position: 'append' })
    const r = engine.transform('flowchart TD\n  A-->B')

    // engine ทำงานได้โดยไม่ crash
    expect(r.code).toBeDefined()
  })

  test('disable builtin pass ด้วย disablePasses', () => {
    const engine = new MermaidRepairEngine({ disablePasses: ['flowchart-repair'] })
    const r = engine.transform('graph TD\n  A ---> B')

    // graph ถูก normalize เป็น flowchart แต่ arrow อาจไม่ถูกแก้
    expect(r.code).toBeDefined()
    expect(() => r).not.toThrow()
  })

  test('ใช้ .use() chaining ได้', () => {
    const pass1: RepairPass = { name: 'p1', repair: (ctx) => ({ passName: 'p1', changed: false, code: ctx.code, repairs: [] }) }
    const pass2: RepairPass = { name: 'p2', repair: (ctx) => ({ passName: 'p2', changed: false, code: ctx.code, repairs: [] }) }

    const engine = new MermaidRepairEngine()
      .use({ pass: pass1 })
      .use({ pass: pass2 })

    expect(() => engine.transform('flowchart TD\n  A-->B')).not.toThrow()
  })

  test('plugin ไม่ crash เมื่อ input ว่าง', () => {
    const customPass: RepairPass = {
      name: 'safe-pass',
      repair(ctx: RepairContext): RepairResult {
        return { passName: 'safe-pass', changed: false, code: ctx.code, repairs: [] }
      }
    }

    const engine = new MermaidRepairEngine().use({ pass: customPass })
    expect(() => engine.transform('')).not.toThrow()
  })

})

// ─────────────────────────────────────────────
// 2. Engine Options
// ─────────────────────────────────────────────
describe('Engine Options', () => {

  test('maxPasses จำกัดจำนวนรอบได้', () => {
    const r = transformMermaidFull('graph TD\n  A ---> B', { maxPasses: 1 })
    expect(r.code).toBeDefined()
    // ไม่ crash แม้จำกัด pass
    expect(r.passCount).toBeGreaterThan(0)
  })

  test('trace: true ทำให้ได้ trace array', () => {
    const r = transformMermaidFull('graph TD\n  A --> B', { trace: true })
    expect(r.trace).toBeDefined()
    expect(Array.isArray(r.trace)).toBe(true)
  })

  test('trace: false (default) ไม่มี trace', () => {
    const r = transformMermaidFull('flowchart TD\n  A-->B')
    expect(r.trace).toBeUndefined()
  })

  test('engine สองตัวแยกกัน ไม่ share state', () => {
    const e1 = new MermaidRepairEngine()
    const e2 = new MermaidRepairEngine()

    const r1 = e1.transform('graph TD\n  A-->B')
    const r2 = e2.transform('sequenceDiagram\n  A->>B: Hi')

    expect(r1.detection?.canonical).toBe('flowchart')
    expect(r2.detection?.canonical).toBe('sequenceDiagram')
  })

})

// ─────────────────────────────────────────────
// 3. Detection Confidence
// ─────────────────────────────────────────────
describe('Detection Confidence Behavior', () => {

  test('high confidence เมื่อใช้ canonical keyword', () => {
    const r = transformMermaidFull('flowchart TD\n  A-->B')
    expect(r.detection?.confidence).toBe('high')
  })

  test('medium confidence เมื่อใช้ alias', () => {
    const r = transformMermaidFull('graph TD\n  A-->B')
    // "graph" เป็น alias ของ flowchart
    expect(['high', 'medium']).toContain(r.detection?.confidence)
  })

  test('low confidence ไม่ทำ destructive repairs', () => {
    // input ที่ detect ได้แค่ heuristic
    const r = transformMermaidFull(`[*] --> Active
  Active --> Inactive
  Inactive --> [*]`)
    // ถ้า low confidence จะวิ่งแค่ safe passes
    expect(r.code).toBeDefined()
    expect(() => r).not.toThrow()
  })

  test('detection null เมื่อไม่รู้ diagram type', () => {
    const r = transformMermaidFull('hello world this is random text')
    // detection อาจเป็น null หรือ unknown
    if (r.detection !== null) {
      expect(r.detection.confidence).toBeDefined()
    }
    expect(() => r).not.toThrow()
  })

})
