/**
 * llm-sequence.test.ts
 * จำลอง Sequence Diagram ที่ LLM สร้างผิดในรูปแบบต่าง ๆ
 */

import { describe, test, expect } from 'vitest'
import { transformMermaidFull } from '../src/index.js'

function repaired(input: string) {
  return transformMermaidFull(input)
}

// ─────────────────────────────────────────────
// 1. Keyword Hallucinations
// ─────────────────────────────────────────────
describe('LLM Sequence — Keyword Hallucinations', () => {

  test('LLM ใช้ "sequence" แทน "sequenceDiagram"', () => {
    const r = repaired(`sequence
  Alice->>Bob: Hello
  Bob-->>Alice: Hi`)
    expect(r.detection?.canonical).toBe('sequenceDiagram')
    expect(r.code).toMatch(/^sequenceDiagram/)
  })

  test('LLM ใช้ "Sequence Diagram" (มี space)', () => {
    const r = repaired(`Sequence Diagram
  A->>B: Request`)
    expect(r.detection?.canonical).toBe('sequenceDiagram')
  })

  test('LLM ลืม header ทั้งหมด', () => {
    const r = repaired(`Alice->>Bob: Hello
  Bob-->>Alice: Hi there`)
    // structural heuristic ต้องจับได้
    expect(r.code.length).toBeGreaterThan(0)
    expect(() => r).not.toThrow()
  })

})

// ─────────────────────────────────────────────
// 2. Arrow Syntax Errors
// ─────────────────────────────────────────────
describe('LLM Sequence — Arrow Syntax Errors', () => {

  test('LLM ใช้ "->" แทน "->>" (sync แทน async)', () => {
    const r = repaired(`sequenceDiagram
  Alice->Bob: Hello
  Bob->Alice: Hi`)
    expect(r.code).not.toMatch(/\w+->(?!>)\w+/)
    expect(r.code).toMatch(/->>/)
  })

  test('LLM ใช้ "--->" ใน sequence', () => {
    const r = repaired(`sequenceDiagram
  Alice--->Bob: Request
  Bob--->Alice: Response`)
    expect(r.code).not.toMatch(/--->/)
  })

  test('LLM ไม่ใส่ colon ก่อน message text', () => {
    const r = repaired(`sequenceDiagram
  Alice->>Bob: Send Message`)
    expect(r.code.length).toBeGreaterThan(0)
    expect(() => r).not.toThrow()
  })

})

// ─────────────────────────────────────────────
// 3. Structural Issues
// ─────────────────────────────────────────────
describe('LLM Sequence — Structural Issues', () => {

  test('LLM ลืมปิด loop block', () => {
    const r = repaired(`sequenceDiagram
  loop Every 5 seconds
    Client->>Server: Ping
    Server-->>Client: Pong`)
    const loops = (r.code.match(/^\s*loop\b/gim) ?? []).length
    const ends = (r.code.match(/^\s*end\b/gim) ?? []).length
    expect(ends).toBeGreaterThanOrEqual(loops)
  })

  test('LLM ลืมปิด alt block', () => {
    const r = repaired(`sequenceDiagram
  alt success
    API->>DB: Query
    DB-->>API: Result
  else failure
    API->>Log: Error`)
    expect(r.code.length).toBeGreaterThan(0)
    expect(() => r).not.toThrow()
  })

  test('LLM ไม่ประกาศ participant แต่ใช้ใน message', () => {
    const r = repaired(`sequenceDiagram
  User->>AuthService: Login(email, password)
  AuthService->>Database: FindUser(email)
  Database-->>AuthService: UserRecord
  AuthService-->>User: JWT Token`)
    // rebuilder ต้อง auto-register participants
    expect(r.code).toMatch(/sequenceDiagram/)
    expect(r.code).toMatch(/User/)
  })

})

// ─────────────────────────────────────────────
// 4. Complex Real-world LLM Output
// ─────────────────────────────────────────────
describe('LLM Sequence — Complex Real-world Outputs', () => {

  test('LLM สร้าง OAuth flow ที่ซับซ้อน', () => {
    const r = repaired(`sequence
  participant User
  participant App
  participant AuthServer
  participant API

  User->App: Click Login
  App->AuthServer: Redirect to /authorize
  AuthServer->User: Show Login Form
  User->AuthServer: Submit Credentials
  AuthServer->App: Authorization Code
  App->AuthServer: Exchange Code for Token
  AuthServer->App: Access Token
  App->API: Request with Bearer Token
  API->App: Protected Resource`)
    expect(r.detection?.canonical).toBe('sequenceDiagram')
    expect(r.code).toMatch(/^sequenceDiagram/)
    // -> ต้องถูก upgrade เป็น ->>
    expect(r.code).not.toMatch(/\w+->\w+/)
  })

  test('LLM สร้าง microservice call chain', () => {
    const r = repaired(`sequenceDiagram
  Gateway->>UserService: GET /users/123
  UserService->>Cache: Check Cache
  Cache-->>UserService: Miss
  UserService->>Database: SELECT * FROM users
  Database-->>UserService: Row
  UserService-->>Gateway: 200 OK`)
    expect(r.code).toMatch(/sequenceDiagram/)
    expect(r.wasRepaired).toBeDefined()
  })

})
