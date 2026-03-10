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
