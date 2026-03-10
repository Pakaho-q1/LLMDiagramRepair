import { transformMermaid } from '../src/index.js'
import { describe, test, expect } from 'vitest'

describe('basic repairs', () => {

test('fix long arrow', () => {
  const r = transformMermaid(`
  graph TD
  A ---> B
  `)

  expect(r).toContain('A --> B')
})

test('fix triple arrow', () => {
  const r = transformMermaid(`
  graph TD
  A ----> B
  `)

  expect(r).toContain('-->')
})

test('upgrade graph keyword', () => {
  const r = transformMermaid(`
  graph TD
  A-->B
  `)

  expect(r).toContain('flowchart')
})

test('remove invalid characters', () => {
  const r = transformMermaid(`
  graph TD
  A-->B $$$
  `)

  expect(r.includes('$$$')).toBe(false)
})

test('trim whitespace', () => {
  const r = transformMermaid(`

  graph TD
  A-->B

  `)

  expect(r.startsWith('flowchart')).toBe(true)
})

test('fix missing direction', () => {
  const r = transformMermaid(`
  flowchart
  A-->B
  `)

  expect(r).toContain('flowchart TD')
})

})