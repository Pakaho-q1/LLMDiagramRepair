'use client';
import React, { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { transformMermaid } from './index.js';
import { isMermaidStreaming, hasMermaidBlock } from './index.js';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
  suppressErrorRendering: true,
});

interface CacheItem<V> {
  value: V;
  expiry: number;
}

class LRUCache<K, V> {
  private map = new Map<K, CacheItem<V>>();
  constructor(
    private limit = 100,
    private ttl = 86_400_000,
  ) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const item = this.map.get(key)!;
    if (Date.now() > item.expiry) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, item);
    return item.value;
  }

  set(key: K, value: V) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.limit) {
      const first = this.map.keys().next();
      if (!first.done) this.map.delete(first.value);
    }
    this.map.set(key, { value, expiry: Date.now() + this.ttl });
  }
}

const svgCache = new LRUCache<string, string>(100);

function useMermaid(chart: string, id: string) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const isStreaming = isMermaidStreaming(chart);

  useEffect(() => {
    if (!chart || isStreaming) return;

    const finalCode = transformMermaid(chart);
    if (!finalCode) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => render(finalCode), 350);

    async function render(code: string) {
      setError(false);
      const cached = svgCache.get(code);
      if (cached) {
        setSvg(cached);
        return;
      }

      const currentId = ++requestIdRef.current;
      try {
        await mermaid.parse(code);
        const { svg } = await mermaid.render(`${id}-${currentId}`, code);
        if (requestIdRef.current !== currentId) return;
        svgCache.set(code, svg);
        setSvg(svg);
      } catch (err) {
        if (requestIdRef.current !== currentId) return;
        console.error('Mermaid render error:', err);
        setError(true);
      }
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [chart, id, isStreaming]);

  return { svg, error, isStreaming };
}

interface Props {
  chart: string;
}

export const MermaidDiagram: React.FC<Props> = ({ chart }) => {
  const rawId = useId();
  const safeId = `mermaid-${rawId.replace(/:/g, '')}`;
  const { svg, error, isStreaming } = useMermaid(chart, safeId);

  if (!chart) return null;

  if (isStreaming || (!svg && !error)) {
    return (
      <div className="animate-pulse text-slate-400 text-sm my-3">
        Rendering diagram...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm my-3">⚠️ Mermaid Syntax Error</div>
    );
  }

  return (
    <div
      className="overflow-x-auto bg-slate-900 rounded-lg p-2 my-3"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
