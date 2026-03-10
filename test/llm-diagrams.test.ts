/**
 * llm-diagrams.test.ts
 * จำลอง Class Diagram, Pie, XYChart, Gantt ที่ LLM สร้างผิด
 */

import { describe, test, expect } from 'vitest'
import { transformMermaidFull } from '../src/index.js'

function repaired(input: string) {
  return transformMermaidFull(input)
}

// ─────────────────────────────────────────────
// CLASS DIAGRAM
// ─────────────────────────────────────────────
describe('LLM Class Diagram — Hallucinations', () => {

  test('LLM ใช้ "classDiagram-v2"', () => {
    const r = repaired(`classDiagram-v2
  class Animal {
    +String name
    +speak() void
  }`)
    expect(r.code).toMatch(/^classDiagram/)
    expect(r.code).not.toMatch(/classDiagram-v2/)
  })

  test('LLM ใช้ "<--" แทน "<|--" สำหรับ inheritance', () => {
    const r = repaired(`classDiagram
  Animal <-- Dog
  Animal <-- Cat`)
    expect(r.code).not.toMatch(/\s<--\s/)
    expect(r.code).toMatch(/<\|--/)
  })

  test('LLM ใช้ "extends" keyword', () => {
    const r = repaired(`classDiagram
  class Dog extends Animal
  class Cat extends Animal`)
    expect(r.code).not.toMatch(/extends/)
    expect(r.code).toMatch(/<\|--/)
  })

  test('LLM ใช้ "implements" keyword', () => {
    const r = repaired(`classDiagram
  class Duck implements Flyable
  class Eagle implements Flyable`)
    expect(r.code).not.toMatch(/implements/)
  })

  test('LLM ลืมปิด class block', () => {
    const r = repaired(`classDiagram
  class User {
    +String id
    +String email
    +login() bool
  class Product {
    +String name
    +Float price`)
    expect(r.code.length).toBeGreaterThan(0)
    expect(() => r).not.toThrow()
  })

  test('LLM สร้าง e-commerce class diagram', () => {
    const r = repaired(`classDiagram
  class Order {
    +String orderId
    +Date createdAt
    +Float total
    +confirm() void
  }
  class OrderItem {
    +int quantity
    +Float price
  }
  class Product {
    +String name
    +Float basePrice
  }
  Order "1" --> "many" OrderItem
  OrderItem --> Product`)
    expect(r.detection?.canonical).toBe('classDiagram')
    expect(r.code).toMatch(/^classDiagram/)
  })

})

// ─────────────────────────────────────────────
// PIE CHART
// ─────────────────────────────────────────────
describe('LLM Pie Chart — Hallucinations', () => {

  test('LLM ใช้ "pieChart" แทน "pie"', () => {
    const r = repaired(`pieChart
  "Chrome" : 65
  "Firefox" : 20
  "Safari" : 15`)
    expect(r.detection?.canonical).toBe('pie')
    expect(r.code).toMatch(/^pie/)
  })

  test('LLM ใช้ "Pie Chart" (มี space)', () => {
    const r = repaired(`Pie Chart
  title Browser Usage
  "Chrome" : 65.5
  "Firefox" : 20.3
  "Safari" : 14.2`)
    expect(r.detection?.canonical).toBe('pie')
  })

  test('LLM ไม่ใส่ quote รอบ label', () => {
    const r = repaired(`pie
  Chrome : 65
  Firefox : 20
  Safari : 15`)
    expect(r.code).toMatch(/^pie/)
    expect(r.code).toMatch(/"Chrome"/)
  })

  test('LLM ใส่ showData flag', () => {
    const r = repaired(`pie showData
  "A" : 40
  "B" : 35
  "C" : 25`)
    expect(r.code).toMatch(/pie showData/)
    expect(r.code).toMatch(/"A" : 40/)
  })

  test('LLM ใช้ "donut" แทน "pie"', () => {
    const r = repaired(`donut
  title Sales by Region
  "North" : 30
  "South" : 25
  "East" : 25
  "West" : 20`)
    expect(r.detection?.canonical).toBe('pie')
    expect(r.code).toMatch(/^pie/)
  })

})

// ─────────────────────────────────────────────
// XY CHART
// ─────────────────────────────────────────────
describe('LLM XY Chart — Hallucinations', () => {

  test('LLM ใช้ "lineChart" แทน "xychart-beta"', () => {
    const r = repaired(`lineChart
  title Monthly Revenue
  x-axis [Jan, Feb, Mar, Apr, May]
  y-axis "Revenue (M)"
  line [10, 15, 12, 18, 22]`)
    expect(r.detection?.canonical).toBe('xychart-beta')
    expect(r.code).toMatch(/^xychart-beta/)
  })

  test('LLM ใช้ "barChart" แทน "xychart-beta"', () => {
    const r = repaired(`barChart
  title Quarterly Sales
  x-axis [Q1, Q2, Q3, Q4]
  y-axis "Sales"
  bar [100, 120, 90, 150]`)
    expect(r.detection?.canonical).toBe('xychart-beta')
    expect(r.code).toMatch(/^xychart-beta/)
    expect(r.code).toMatch(/bar/)
  })

  test('LLM ใช้ "xychart" (ไม่มี -beta)', () => {
    const r = repaired(`xychart
  x-axis ["Mon", "Tue", "Wed"]
  y-axis "Value"
  line [5, 8, 3]`)
    expect(r.code).toMatch(/^xychart-beta/)
  })

  test('LLM ใช้ key-value format แทน array', () => {
    const r = repaired(`lineChart
  title Score
  Jan : 80
  Feb : 85
  Mar : 78
  Apr : 92`)
    expect(r.detection?.canonical).toBe('xychart-beta')
    expect(r.code).toMatch(/xychart-beta/)
  })

})

// ─────────────────────────────────────────────
// GANTT
// ─────────────────────────────────────────────
describe('LLM Gantt — Hallucinations', () => {

  test('LLM ลืม dateFormat', () => {
    const r = repaired(`gantt
  title Project Plan
  section Phase 1
  Task A : 2024-01-01, 7d`)
    expect(r.code).toMatch(/dateFormat/)
    expect(r.wasRepaired).toBe(true)
  })

  test('LLM ใช้ "Gantt Chart" แทน "gantt"', () => {
    const r = repaired(`Gantt Chart
  title Sprint Plan
  section Development
  Feature A : 2024-01-01, 5d`)
    expect(r.detection?.canonical).toBe('gantt')
    expect(r.code).toMatch(/^gantt/)
  })

  test('LLM ลืม header "gantt" ทั้งหมด', () => {
    const r = repaired(`title My Project
  section Development
  Task 1 : 2024-01-01, 3d
  Task 2 : 2024-01-04, 5d`)
    expect(r.code.length).toBeGreaterThan(0)
    expect(() => r).not.toThrow()
  })

})
