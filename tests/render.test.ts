import mermaid from 'mermaid'
import { transformMermaid } from '../src/index.js'
import { describe, test, expect } from 'vitest'

describe('render compatibility', () => {

test('render repaired diagram', async () => {

  const raw = `A ---> B`

  const fixed = transformMermaid(raw)

  await expect(mermaid.parse(fixed)).resolves.not.toThrow()

})

test('render valid diagram', async () => {

  const raw = `
  flowchart TD
  A-->B
  `

  await expect(mermaid.parse(raw)).resolves.not.toThrow()

})

test('render large diagram', async () => {

  const raw = `
  flowchart TD
  A-->B
  B-->C
  C-->D
  `

  await expect(mermaid.parse(raw)).resolves.not.toThrow()

})

})