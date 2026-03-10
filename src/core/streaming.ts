export function isMermaidStreaming(text: string): boolean {
  const started = /```mermaid/i.test(text);
  const finished = /```mermaid[\s\S]*?```/i.test(text);
  return started && !finished;
}
export function hasMermaidBlock(text: string): boolean {
  return /```mermaid[\s\S]*?```/i.test(text);
}
export function getStreamingPartial(text: string): string | null {
  if (!isMermaidStreaming(text)) return null;
  const match = text.match(/```mermaid\s*([\s\S]*?)$/i);
  return match ? match[1].trim() : null;
}
export class StreamingTimeoutTracker {
  private startTime: number | null = null;
  private readonly timeoutMs: number;

  constructor(timeoutMs = 10_000) {
    this.timeoutMs = timeoutMs;
  }

  start(): void {
    if (this.startTime === null) {
      this.startTime = Date.now();
    }
  }

  reset(): void {
    this.startTime = null;
  }

  isTimedOut(): boolean {
    if (this.startTime === null) return false;
    return Date.now() - this.startTime > this.timeoutMs;
  }

  elapsed(): number {
    if (this.startTime === null) return 0;
    return Date.now() - this.startTime;
  }
}
