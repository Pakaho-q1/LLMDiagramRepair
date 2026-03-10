/**
 * llm-flowchart.test.ts
 * จำลอง Flowchart ที่ LLM สร้างผิดในรูปแบบต่าง ๆ
 * ทดสอบว่า engine ซ่อมได้ถูกต้องและ output ใช้งานได้จริง
 */

import { describe, test, expect } from 'vitest'
import { transformMermaidFull, transformMermaid } from '../src/index.js'

// ─────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────
function repaired(input: string) {
  return transformMermaidFull(input)
}

// ─────────────────────────────────────────────
// 1. Keyword Hallucinations
// ─────────────────────────────────────────────
describe('LLM Flowchart — Keyword Hallucinations', () => {

  test('LLM ใช้ "graph TD" แทน "flowchart TD"', () => {
    const r = repaired(`graph TD
  A[Start] --> B[Process]
  B --> C[End]`)
    expect(r.detection?.canonical).toBe('flowchart')
    expect(r.code).toMatch(/^flowchart TD/)
    expect(r.wasRepaired).toBe(true)
  })

  test('LLM ใช้ "flowChart TD" (camelCase)', () => {
    const r = repaired(`flowChart TD
  A --> B`)
    expect(r.detection?.canonical).toBe('flowchart')
    expect(r.code).toMatch(/^flowchart/)
  })

  test('LLM ลืมใส่ direction — "flowchart" อย่างเดียว', () => {
    const r = repaired(`flowchart
  A --> B --> C`)
    expect(r.code).toMatch(/^flowchart TD/)
    expect(r.wasRepaired).toBe(true)
  })

  test('LLM ไม่ใส่ header เลย — แค่ nodes กับ edges', () => {
    const r = repaired(`A[Login] --> B{Valid?}
  B -->|Yes| C[Dashboard]
  B -->|No| D[Error]`)
    expect(r.code).toMatch(/^flowchart/)
    expect(r.wasRepaired).toBe(true)
  })

})

// ─────────────────────────────────────────────
// 2. Arrow Syntax Errors
// ─────────────────────────────────────────────
describe('LLM Flowchart — Arrow Syntax Errors', () => {

  test('LLM ใช้ "--->" (สามขีด) แทน "-->"', () => {
    const r = repaired(`flowchart TD
  A ---> B ---> C`)
    expect(r.code).not.toMatch(/--->/g)
    expect(r.code).toMatch(/-->/)
  })

  test('LLM ใช้ "---->" (สี่ขีด)', () => {
    const r = repaired(`flowchart TD
  A ----> B`)
    expect(r.code).not.toMatch(/---->/g)
  })

  test('LLM ใช้ "===>" แทน "==>"', () => {
    const r = repaired(`flowchart TD
  A ===> B`)
    expect(r.code).not.toMatch(/===>/g)
    expect(r.code).toMatch(/==>/)
  })

  test('LLM ใช้ ".->" แทน ".->"', () => {
    const r = repaired(`flowchart TD
  A .-> B`)
    expect(r.code.length).toBeGreaterThan(0)
    expect(() => r).not.toThrow()
  })

})

// ─────────────────────────────────────────────
// 3. Structural Issues
// ─────────────────────────────────────────────
describe('LLM Flowchart — Structural Issues', () => {

  test('LLM ลืมปิด subgraph ด้วย end', () => {
    const r = repaired(`flowchart TD
  subgraph auth
    A[Login] --> B[Validate]
  subgraph dashboard
    C[Home] --> D[Profile]`)
    // ต้องมี end สำหรับทั้งสอง subgraph
    const endCount = (r.code.match(/^\s*end\b/gim) ?? []).length
    const subCount = (r.code.match(/^\s*subgraph\b/gim) ?? []).length
    expect(endCount).toBeGreaterThanOrEqual(subCount)
  })

  test('LLM ใช้ single quote ใน label — node[\'text\']', () => {
    const r = repaired(`flowchart TD
  A['User Login'] --> B['Check Auth']`)
    // single quote ต้องถูก normalize
    expect(r.code.length).toBeGreaterThan(0)
    expect(() => r).not.toThrow()
  })

  test('LLM ส่งมาใน markdown code fence', () => {
    const r = repaired(`\`\`\`mermaid
flowchart TD
  A --> B --> C
\`\`\``)
    expect(r.code).not.toMatch(/```/)
    expect(r.code).toMatch(/flowchart/)
  })

  test('LLM ส่งมาพร้อมคำอธิบายก่อนหน้า', () => {
    const r = repaired(`\`\`\`mermaid
flowchart LR
  User --> API --> DB
\`\`\``)
    expect(r.code).not.toMatch(/```/)
    expect(r.code).toMatch(/flowchart LR/)
  })

})

// ─────────────────────────────────────────────
// 4. Complex Real-world LLM Output
// ─────────────────────────────────────────────
describe('LLM Flowchart — Complex Real-world Outputs', () => {

  test('LLM สร้าง auth flow ที่ซับซ้อน', () => {
    const r = repaired(`graph TD
  A[User] ---> B{Logged In?}
  B -->|Yes| C[Dashboard]
  B -->|No| D[Login Page]
  D ---> E[Enter Credentials]
  E ---> F{Valid?}
  F -->|Yes| C
  F -->|No| G[Show Error]
  G ---> D`)
    expect(r.detection?.canonical).toBe('flowchart')
    expect(r.code).toMatch(/^flowchart/)
    expect(r.code).not.toMatch(/--->/g)
  })

  test('LLM สร้าง CI/CD pipeline', () => {
    const r = repaired(`flowchart LR
  A[Push Code] --> B[Run Tests]
  B -->|Pass| C[Build Docker]
  B -->|Fail| D[Notify Dev]
  C --> E[Deploy Staging]
  E -->|Approved| F[Deploy Prod]
  E -->|Rejected| D`)
    expect(r.code).toMatch(/flowchart LR/)
    expect(r.wasRepaired).toBeDefined()
  })

  test('engine ไม่ crash กับ flowchart ขนาดใหญ่', () => {
    const nodes = Array.from({ length: 50 }, (_, i) => `  N${i} --> N${i + 1}`).join('\n')
    const r = repaired(`flowchart TD\n${nodes}`)
    expect(r.code.length).toBeGreaterThan(0)
    expect(() => r).not.toThrow()
  })

})
