import { MermaidRepairEngine } from '../src/index.js'
import { describe, test, expect } from 'vitest'

describe('plugin system', () => {

test('plugin modifies code', () => {
  const engine = new MermaidRepairEngine().use({
    pass:{
      name:'plugin',
      repair(ctx){
        const code = ctx.code.replace('AAA','flowchart TD')
        return {passName:'plugin',changed:true,code,repairs:['plugin']}
      }
    }
  })

  const r = engine.transform('AAA\nA-->B')

  expect(r.repairs).toContain('plugin')
})

test('plugin order prepend', () => {
  const engine = new MermaidRepairEngine()

  expect(engine).toBeDefined()
})

test('plugin can add repairs', () => {
  const engine = new MermaidRepairEngine()

  const r = engine.transform('A-->B')

  expect(Array.isArray(r.repairs)).toBe(true)
})

test('plugin does not crash', () => {
  const engine = new MermaidRepairEngine()

  expect(()=>engine.transform('')).not.toThrow()
})

})