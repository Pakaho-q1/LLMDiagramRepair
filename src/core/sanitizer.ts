export function extractMermaidBlock(text: string): string {
  const backtick = text.match(/`{3,}mermaid\s*\n?([\s\S]*?)`{3,}/i);
  if (backtick) return backtick[1].trim();

  const tilde = text.match(/~{3,}mermaid\s*\n?([\s\S]*?)~{3,}/i);
  if (tilde) return tilde[1].trim();

  const htmlTag = text.match(/<mermaid[^>]*>([\s\S]*?)<\/mermaid>/i);
  if (htmlTag) return htmlTag[1].trim();

  return text.trim();
}

export function sanitize(code: string): string {
  return code
    .trim()

    .replace(/^\uFEFF/, "")

    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ")

    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')

    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")

    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

    .replace(/^`{3,}mermaid\s*/i, "")
    .replace(/^`{3,}\s*/i, "")
    .replace(/\s*`{3,}$/i, "")

    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
}

export function normalizeIndentation(code: string): string {
  const lines = code.split("\n");
  if (!lines.length) return code;

  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const minIndent = nonEmpty.reduce((min, l) => {
    const indent = l.match(/^(\s*)/)?.[1].length ?? 0;
    return Math.min(min, indent);
  }, Infinity);

  if (minIndent === 0 || minIndent === Infinity) return code;

  return lines
    .map((l) => (l.trim().length === 0 ? "" : l.slice(minIndent)))
    .join("\n");
}

export function preprocess(raw: string): string {
  const extracted = extractMermaidBlock(raw);
  const cleaned = sanitize(extracted);
  return normalizeIndentation(cleaned);
}
