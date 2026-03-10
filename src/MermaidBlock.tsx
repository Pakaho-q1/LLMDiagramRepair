// MermaidBlock.tsx
import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Maximize2, X } from 'lucide-react';
import { transformMermaid } from './index.js';
import { MermaidDiagram } from './MermaidDiagram';

interface Props {
  codeString: string;
}

export const MermaidBlock: React.FC<Props> = ({ codeString }) => {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openModal = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsModalOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };

    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const handleWheel = (e: React.WheelEvent) => {
    const scaleAdjustment = e.deltaY * -0.002;
    const newScale = Math.min(Math.max(0.5, scale + scaleAdjustment), 5);
    setScale(newScale);
  };
  const [clickStart, setClickStart] = useState({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    setClickStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);

    const moveX = Math.abs(e.clientX - clickStart.x);
    const moveY = Math.abs(e.clientY - clickStart.y);

    if (moveX < 5 && moveY < 5 && e.target === e.currentTarget) {
      setIsModalOpen(false); // สั่งปิดหน้าต่าง
    }
  };

  return (
    <>
      <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-[#1E1E1E] shadow-lg shadow-black/30">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-2 bg-slate-900 border-b border-slate-700/50">
          {/* Segmented Control */}
          <div className="relative flex bg-slate-800 rounded-xl p-0.5">
            <div
              className={`absolute top-1 bottom-1 w-1/2 rounded-lg bg-blue-600 transition-all duration-300 ease-in-out ${
                viewMode === 'preview' ? 'left-1' : 'left-[calc(50%+2px)]'
              }`}
            />
            <button
              onClick={() => setViewMode('preview')}
              className="relative z-10 px-4 py-1.5 text-xs font-medium text-white transition-opacity duration-200"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10 10.4996L7.91896 9.06884C5.48539 7.39575 4.2686 6.55921 3.28823 6.93255C3.13803 6.98975 2.99528 7.06484 2.86306 7.15621C2 7.75256 2 9.22917 2 12.1824C2 15.0044 2 16.4155 2.83131 17.0141C2.95911 17.1061 3.09732 17.1827 3.24309 17.2423C4.1913 17.63 5.38785 16.8821 7.78094 15.3865L10 13.9995V10.4996Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="my-path"
                ></path>
                <path
                  d="M16.0857 8.64347C18.7243 10.2233 20.0435 11.0132 20.0303 12.1619C20.0171 13.3107 18.6801 14.0701 16.0059 15.5888C13.3271 17.1102 11.9877 17.8709 10.9939 17.2923C10 16.7138 10 15.1735 10 12.0929C10 8.93962 10 7.36299 11.0138 6.78837C12.0276 6.21374 13.3803 7.02365 16.0857 8.64347Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="my-path"
                ></path>
              </svg>
            </button>
            <button
              onClick={() => setViewMode('code')}
              className="relative z-10 px-4 py-1.5 text-xs font-medium text-white transition-opacity duration-200"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 3H21"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  className="my-path"
                />
                <path
                  d="M3 9H21"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  className="my-path"
                />
                <path
                  d="M3 14.5H10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  className="my-path"
                />
                <path
                  d="M3 20H10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  className="my-path"
                />
                <path
                  d="M17.9611 15.2632C19.31 16.034 19.9844 16.4194 19.9844 16.9997C19.9844 17.58 19.31 17.9654 17.9611 18.7362L16.9923 19.2898C15.6615 20.0503 14.9961 20.4305 14.4981 20.1415C14 19.8524 14 19.0861 14 17.5534L14 16.4461C14 14.9134 14 14.147 14.4981 13.858C14.9961 13.5689 15.6615 13.9492 16.9923 14.7096L17.9611 15.2632Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="my-path"
                />
              </svg>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* Maximize Button (Show only in preview) */}
            {viewMode === 'preview' && (
              <button
                onClick={openModal}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all duration-200"
                title="Full Screen"
              >
                <Maximize2 size={15} className="text-slate-300" />
              </button>
            )}

            {/* Copy Button (Show only in code) */}
            {viewMode === 'code' && (
              <button
                onClick={handleCopy}
                className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all duration-200"
              >
                <div
                  className={`absolute transition-all duration-200 ${copied ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
                >
                  <Check size={15} className="text-green-400" />
                </div>
                <div
                  className={`transition-all duration-200 ${copied ? 'scale-75 opacity-0' : 'scale-100 opacity-100'}`}
                >
                  <Copy size={15} className="text-slate-300" />
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="relative overflow-hidden">
          {/* Preview */}
          <div
            className={`transition-all duration-300 ease-in-out ${viewMode === 'preview' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 absolute inset-0 pointer-events-none'}`}
          >
            <div
              className="p-1 bg-slate-900 cursor-zoom-in"
              onClick={openModal}
            >
              <MermaidDiagram chart={codeString} />
            </div>
          </div>

          {/* Code */}
          <div
            className={`transition-all duration-300 ease-in-out ${viewMode === 'code' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 absolute inset-0 pointer-events-none'}`}
          >
            <SyntaxHighlighter
              style={vscDarkPlus}
              language="mermaid"
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: 0,
                background: 'transparent',
                padding: '1.25rem',
              }}
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal Overlay */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute top-6 right-6 z-50 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>

          {/* Interactive Area (Pan & Zoom) */}
          <div
            className={`w-full h-full overflow-hidden flex items-center justify-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onClick={(e) => e.stopPropagation()}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <div
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                transformOrigin: 'center',
              }}
              className="p-8 bg-slate-900 rounded-xl shadow-2xl"
            >
              <MermaidDiagram chart={codeString} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
