/**
 * fuzz.test.ts
 * Property-Based Testing โดยใช้ fast-check
 * สุ่มสร้าง Input หลักพันรูปแบบเพื่อหา Edge Cases ที่ทำให้ระบบพัง หรือเกิด ReDoS
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { transformMermaidFull } from '../src/index.js';

describe('Fuzz Testing & ReDoS Prevention', () => {

  test('ระบบต้องไม่ Crash เมื่อเจอข้อความสุ่มทุกรูปแบบ (Random Strings)', () => {
    fc.assert(
      fc.property(fc.string(), (randomText) => {
        expect(() => transformMermaidFull(randomText)).not.toThrow();
      }),
      { numRuns: 1000 }
    );
  });

  test('ระบบต้องไม่ Crash เมื่อมี Keyword Mermaid ปะปนกับข้อมูลขยะ', () => {
    const diagramKeywords = fc.constantFrom(
      'flowchart TD\n', 'sequenceDiagram\n', 'classDiagram\n', 'pie\n', 'gantt\n'
    );

    fc.assert(
      fc.property(
        fc.string(), diagramKeywords, fc.string(),
        (prefix, keyword, suffix) => {
          const input = `${prefix}\n${keyword}\n${suffix}`;
          expect(() => transformMermaidFull(input)).not.toThrow();
        }
      ),
      { numRuns: 500 }
    );
  });

  test('ทดสอบหาช่องโหว่ ReDoS (Regular Expression Denial of Service)', () => {
    // ใช้สัญลักษณ์ที่มักทำให้ Regex เกิด Catastrophic Backtracking
    const dangerousChars = fc.constantFrom('-', '=', '.', '>', '<', ' ', '\n', 'A', '[');
    
    fc.assert(
      fc.property(
        // ใช้ fc.array().map(...) แทน fc.stringOf() เพื่อความเข้ากันได้กับ fast-check ทุกเวอร์ชัน
        fc.array(dangerousChars, { maxLength: 50000 }).map(arr => arr.join('')), 
        (malformedArrows) => {
          const input = `flowchart TD\n${malformedArrows}`;
          
          const start = performance.now();
          transformMermaidFull(input);
          const end = performance.now();
          
          // ไม่ควรใช้เวลาเกิน 1 วินาที สำหรับ String ขยะ 50,000 ตัวอักษร
          expect(end - start).toBeLessThan(1000); 
        }
      ),
      { numRuns: 100 }
    );
  });

});