import { transformMermaid } from '../src/index.js'
import { describe, test, expect } from 'vitest'

describe('robustness', () => {

test('empty input', () => {
  expect(()=>transformMermaid('')).not.toThrow()
})

test('random text', () => {
  expect(()=>transformMermaid('hello world')).not.toThrow()
})

test('large input', () => {
  const big = 'A-->B\n'.repeat(1000)
  expect(()=>transformMermaid(big)).not.toThrow()
})

})