
import React, { useState, useEffect, useRef } from 'react';
import { SpeechBubble } from '../types';

interface ControlPanelProps {
  bubble: SpeechBubble;
  initialPosition: { 
    top: string; 
    left: string; 
    vAlign: 'top' | 'bottom'; 
  };
  onUpdate: (updated: Partial<SpeechBubble>) => void;
  onClose: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ bubble, initialPosition, onUpdate, onClose }) => {
  const [fontSizeScale, setFontSizeScale] = useState(bubble.fontSizeScale || 1.0);
  const [originalCopyStatus, setOriginalCopyStatus] = useState<'idle' | 'copied'>('idle');
  
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setFontSizeScale(bubble.fontSizeScale || 1.0);
    setPos({ x: 0, y: 0 });
    setOriginalCopyStatus('idle');
  }, [bubble.id, bubble.fontSizeScale]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button')) {
      return;
    }
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragging(true);
    dragStart.current = { x: clientX - pos.x, y: clientY - pos.y };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging) return;
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      setPos({ x: clientX - dragStart.current.x, y: clientY - dragStart.current.y });
    };
    const handleUp = () => setDragging(false);
    if (dragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setOriginalCopyStatus('copied');
      setTimeout(() => setOriginalCopyStatus('idle'), 2000);
    } catch (err) { console.error(err); }
  };

  return (
    <div 
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
      className={`absolute z-[200] w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-0 select-none transition-shadow ${dragging ? 'cursor-grabbing ring-2 ring-blue-500/50' : 'cursor-grab'}`}
      style={{ 
        top: initialPosition.top, 
        left: initialPosition.left,
        transform: `translate(${pos.x}px, ${pos.y}px) ${initialPosition.vAlign === 'top' ? 'translateY(-105%)' : 'translateY(5%)'} translateX(-50%)`,
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-t-2xl border-b border-white/5 pointer-events-none">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Layout Controls</span>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all pointer-events-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[9px] text-slate-500 font-black uppercase">Original Text</label>
            <button onClick={(e) => { e.stopPropagation(); handleCopy(bubble.originalText); }} className={`text-[9px] font-bold px-2 py-0.5 rounded ${originalCopyStatus === 'copied' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-white'}`}>
              {originalCopyStatus === 'copied' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="bg-black/30 p-2 rounded text-[10px] text-slate-400 line-clamp-2">{bubble.originalText}</div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[9px] text-slate-500 font-black uppercase">Font Scale</label>
            <span className="text-[10px] text-blue-400 font-mono">{Math.round(fontSizeScale * 100)}%</span>
          </div>
          <input 
            type="range" min="0.5" max="2.0" step="0.05" value={fontSizeScale}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setFontSizeScale(val);
              onUpdate({ fontSizeScale: val });
            }}
            className="w-full h-1 bg-slate-800 rounded-full appearance-none accent-blue-500 cursor-pointer"
          />
        </div>
        
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-xl text-[11px] font-bold text-white transition-all"
        >
          Done Editing
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
