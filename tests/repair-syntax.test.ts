import { transformMermaid } from '../src/index.js'
import { describe, test, expect } from 'vitest'

describe('syntax repairs', () => {

test('fix arrow spacing', () => {
  const r = transformMermaid(`A-->B`)
  expect(r).toContain('A --> B')
})

test('fix missing node', () => {
  const r = transformMermaid(`flowchart TD\n--> B`)
  expect(r.length).toBeGreaterThan(0)
})

test('fix incomplete arrow', () => {
  const r = transformMermaid(`flowchart TD\nA -->`)
  expect(r.includes('-->')).toBe(true)
})

test('remove duplicated arrows', () => {
  const r = transformMermaid(`A --> --> B`)
  expect(r.includes('--> -->')).toBe(false)
})

test('fix malformed edge', () => {
  const r = transformMermaid(`A -- > B`)
  expect(r.includes('-->')).toBe(true)
})

test('normalize line endings', () => {
  const r = transformMermaid("flowchart TD\r\nA-->B")
  expect(r.includes('\r')).toBe(false)
})

})