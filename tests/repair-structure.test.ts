import { transformMermaid } from '../src/index.js'
import { describe, test, expect } from 'vitest'

describe('structure repairs', () => {

test('add missing header', () => {
  const r = transformMermaid(`A-->B`)
  expect(r.startsWith('flowchart')).toBe(true)
})

test('preserve valid diagram', () => {
  const raw = `
  flowchart TD
  A-->B
  `

  const r = transformMermaid(raw)

  expect(r.includes('A --> B')).toBe(true)
})

test('fix indentation', () => {
  const r = transformMermaid(`flowchart TD\n   A-->B`)
  expect(r.includes('A')).toBe(true)
})

test('collapse empty lines', () => {
  const r = transformMermaid(`flowchart TD\n\n\nA-->B`)
  expect(r.includes('\n\n\n')).toBe(false)
})

test('remove markdown fences', () => {
  const r = transformMermaid(`
\`\`\`mermaid
A-->B
\`\`\`
`)
  expect(r.includes('```')).toBe(false)
})

})