// ─────────────────────────────────────────────
// streaming.ts
// Phase 3.2: เพิ่ม timeout fallback สำหรับ streaming ที่ไม่จบ
// ─────────────────────────────────────────────

/**
 * ตรวจว่า text อยู่ในระหว่าง streaming (มี ```mermaid แต่ยังไม่ปิด ```)
 */
export function isMermaidStreaming(text: string): boolean {
  const started = /```mermaid/i.test(text);
  const finished = /```mermaid[\s\S]*?```/i.test(text);
  return started && !finished;
}

/**
 * ตรวจว่า text มี mermaid block ที่สมบูรณ์
 */
export function hasMermaidBlock(text: string): boolean {
  return /```mermaid[\s\S]*?```/i.test(text);
}

/**
 * ดึง partial content ออกมาจาก streaming block ที่ยังไม่จบ
 */
export function getStreamingPartial(text: string): string | null {
  if (!isMermaidStreaming(text)) return null;
  const match = text.match(/```mermaid\s*([\s\S]*?)$/i);
  return match ? match[1].trim() : null;
}

// ─────────────────────────────────────────────
// Phase 3.2: Streaming Timeout Tracker
// ─────────────────────────────────────────────

/**
 * ติดตาม streaming timeout per diagram instance
 * ใช้ใน MermaidDiagram เพื่อ fallback render เมื่อ timeout
 */
export class StreamingTimeoutTracker {
  private startTime: number | null = null;
  private readonly timeoutMs: number;

  constructor(timeoutMs = 10_000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * เริ่ม track streaming (เรียกเมื่อ isStreaming = true ครั้งแรก)
   */
  start(): void {
    if (this.startTime === null) {
      this.startTime = Date.now();
    }
  }

  /**
   * Reset tracker (เรียกเมื่อ streaming จบแล้ว หรือ component unmount)
   */
  reset(): void {
    this.startTime = null;
  }

  /**
   * ตรวจว่า streaming เกิน timeout แล้วหรือยัง
   * ถ้าเกิน → ควร fallback render partial content แทนที่จะ block ตลอด
   */
  isTimedOut(): boolean {
    if (this.startTime === null) return false;
    return Date.now() - this.startTime > this.timeoutMs;
  }

  /**
   * เวลาที่ streaming ดำเนินมาแล้ว (ms)
   */
  elapsed(): number {
    if (this.startTime === null) return 0;
    return Date.now() - this.startTime;
  }
}
