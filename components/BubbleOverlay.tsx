
import React from 'react';
import { SpeechBubble } from '../types';

interface BubbleOverlayProps {
  bubbles: SpeechBubble[];
  onSelect: (bubble: SpeechBubble) => void;
  onTextUpdate: (id: string, text: string) => void;
  selectedId?: string;
}

const BubbleOverlay: React.FC<BubbleOverlayProps> = ({ bubbles, onSelect, onTextUpdate, selectedId }) => {
  
  // وظيفة لتنظيف النص الملصق من أي تنسيقات HTML خارجية
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {bubbles.map((bubble) => {
        const [ymin, xmin, ymax, xmax] = bubble.box;
        
        const top = ymin / 10;
        const left = xmin / 10;
        const width = (xmax - xmin) / 10;
        const height = (ymax - ymin) / 10;

        const isSelected = selectedId === bubble.id;
        const textToShow = bubble.modifiedText !== undefined ? bubble.modifiedText : bubble.originalText;
        const scale = (bubble.fontSizeScale || 1.0);
        const bgColor = bubble.backgroundColor || "#FFFFFF";
        const textColor = bubble.textColor || "#000000";

        const isArabic = /[\u0600-\u06FF]/.test(textToShow);

        return (
          <div
            key={bubble.id}
            className={`absolute pointer-events-auto transition-all duration-300
              ${isSelected ? 'z-20' : 'z-10 hover:bg-blue-500/5'}
            `}
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `${width}%`,
              height: `${height}%`,
            }}
            onClick={() => onSelect(bubble)}
          >
            <div className={`absolute inset-0 rounded-lg border-2 transition-colors 
              ${isSelected ? 'border-blue-500 bg-blue-500/5' : 'border-dashed border-slate-400/10'}
            `} />

            <div 
              className={`absolute inset-0 shadow-md flex items-center justify-center transition-all duration-300
                ${isSelected ? 'ring-2 ring-blue-400 scale-[1.03]' : ''}
              `}
              style={{ 
                borderRadius: '16px',
                minWidth: '100%',
                minHeight: '100%',
                padding: '4%',
                backgroundColor: bgColor,
              }}
            >
              <div 
                className="w-full h-full flex items-center justify-center overflow-visible"
                dir="auto"
              >
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => onTextUpdate(bubble.id, e.currentTarget.innerText)}
                  onPaste={handlePaste}
                  onClick={(e) => e.stopPropagation()}
                  className={`text-center w-full break-words outline-none transition-all
                    ${isSelected ? 'cursor-text' : 'cursor-pointer'}
                  `}
                  style={{
                    color: textColor,
                    fontFamily: isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif",
                    fontSize: `clamp(8px, ${(Math.min(width, height) * 0.45) * scale}px, 60px)`,
                    // زيادة مساحة الخط العربي لأن الحروف العربية أطول رأسياً
                    lineHeight: isArabic ? '1.4' : '1.1',
                    maxHeight: '120%', 
                    overflow: 'visible', // السماح للنص بالظهور حتى لو تجاوز الصندوق قليلاً
                    direction: isArabic ? 'rtl' : 'ltr',
                    display: 'block',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {textToShow}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BubbleOverlay;
