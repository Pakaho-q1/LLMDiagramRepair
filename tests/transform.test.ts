import { transformMermaidFull } from '../src/index.js'
import { describe, test, expect } from 'vitest'

describe('transform pipeline', () => {

test('returns result object', () => {
  const r = transformMermaidFull(`A-->B`)
  expect(r.code).toBeDefined()
})

test('records repairs', () => {
  const r = transformMermaidFull(`A ---> B`)
  expect(r.repairs.length).toBeGreaterThan(0)
})

test('wasRepaired true when changes', () => {
  const r = transformMermaidFull(`A ---> B`)
  expect(r.wasRepaired).toBe(true)
})

test('trace mode works', () => {
  const r = transformMermaidFull(`A-->B`, { trace: true })
  expect(r.trace).toBeDefined()
})

})