import { isMermaidStreaming } from '../src/index.js'
import { describe, test, expect } from 'vitest'

describe('streaming detection', () => {

test('detect partial arrow', () => {
  expect(isMermaidStreaming('A -->')).toBe(true)
})

test('detect open code fence', () => {
  expect(isMermaidStreaming('```mermaid')).toBe(true)
})

test('detect unfinished block', () => {
  expect(isMermaidStreaming('flowchart TD\nA')).toBe(true)
})

test('valid diagram not streaming', () => {
  expect(isMermaidStreaming('flowchart TD\nA-->B')).toBe(false)
})

})