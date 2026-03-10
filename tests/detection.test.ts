import { transformMermaidFull } from '../src/index.js'
import { describe, test, expect } from 'vitest'

describe('diagram detection', () => {

test('detect flowchart', () => {
  const r = transformMermaidFull(`
  graph TD
  A-->B
  `)

  expect(r.detection.kind).toBe('flowchart')
})

test('detect flowchart with flowchart keyword', () => {
  const r = transformMermaidFull(`
  flowchart TD
  A-->B
  `)

  expect(r.detection.kind).toBe('flowchart')
})

test('detect sequence diagram', () => {
  const r = transformMermaidFull(`
  sequenceDiagram
  A->>B: hello
  `)

  expect(r.detection.kind).toBe('sequence')
})

test('detect class diagram', () => {
  const r = transformMermaidFull(`
  classDiagram
  class A
  `)

  expect(r.detection.kind).toBe('class')
})

test('unknown diagram', () => {
  const r = transformMermaidFull(`hello world`)

  expect(r.detection.kind).toBe('unknown')
})

})