
import React, { useState, useRef } from 'react';
import { ComicPage, SpeechBubble } from './types';
import { analyzeComicPage } from './services/geminiService';
import BubbleOverlay from './components/BubbleOverlay';
import ControlPanel from './components/ControlPanel';

const App: React.FC = () => {
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | undefined>();
  const [isExporting, setIsExporting] = useState(false);
  const [editorPos, setEditorPos] = useState<{
    top: string; 
    left: string; 
    vAlign: 'top' | 'bottom'; 
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const files: File[] = Array.from(fileList);
    const newPages: ComicPage[] = files.map((file) => ({
      id: Math.random().toString(36).substring(2, 11),
      url: URL.createObjectURL(file),
      name: file.name,
      file: file,
      bubbles: [],
      status: 'pending'
    }));

    setPages(prev => {
      const updated = [...prev, ...newPages];
      if (prev.length === 0) {
        setTimeout(() => processPage(0, updated), 100);
      }
      return updated;
    });
  };

  const processPage = async (index: number, currentPages = pages) => {
    const page = currentPages[index];
    if (!page || page.status === 'analyzing') return;

    setPages(prev => prev.map((p, i) => i === index ? { ...p, status: 'analyzing' } : p));

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await analyzeComicPage(base64);
        
        const bubbles: SpeechBubble[] = result.bubbles.map((b, bIdx) => ({
          id: `bubble-${index}-${bIdx}`,
          originalText: b.text,
          box: b.box_2d,
          backgroundColor: b.background_color,
          textColor: b.text_color,
          lang: 'en'
        }));

        setPages(prev => prev.map((p, i) => i === index ? { ...p, bubbles, status: 'ready' } : p));
      };
      reader.readAsDataURL(page.file);
    } catch (error) {
      setPages(prev => prev.map((p, i) => i === index ? { ...p, status: 'error' } : p));
    }
  };

  const handleBubbleSelect = (bubble: SpeechBubble) => {
    setSelectedBubbleId(bubble.id);
    const [ymin, xmin, ymax, xmax] = bubble.box;
    const midX = (xmin + xmax) / 2;
    
    const vAlign: 'top' | 'bottom' = ymin > 500 ? 'top' : 'bottom';
    const topPos = vAlign === 'top' ? ymin : ymax;
    
    setEditorPos({
      top: `${topPos / 10}%`,
      left: `${midX / 10}%`,
      vAlign
    });
  };

  const updateBubble = (bubbleId: string, updates: Partial<SpeechBubble>) => {
    setPages(prev => prev.map((p, pIdx) => {
      if (pIdx !== currentIndex) return p;
      return {
        ...p,
        bubbles: p.bubbles.map(b => b.id === bubbleId ? { ...b, ...updates } : b)
      };
    }));
  };

  const handleOverlayTextUpdate = (id: string, text: string) => {
    updateBubble(id, { modifiedText: text });
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  };

  const exportCurrentPage = async () => {
    const page = pages[currentIndex];
    if (!page || isExporting) return;

    setIsExporting(true);
    try {
      // التأكد من تحميل الخطوط قبل الرسم
      await Promise.all([
        document.fonts.load('bold 16px Cairo'),
        document.fonts.load('bold 16px Inter')
      ]);

      const img = new Image();
      const imageReady = new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = page.url;
      });
      await imageReady;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error("Context error");

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      for (const bubble of page.bubbles) {
        const textToDraw = bubble.modifiedText !== undefined ? bubble.modifiedText : bubble.originalText;
        if (!textToDraw) continue;

        const isArabic = /[\u0600-\u06FF]/.test(textToDraw);
        const [ymin, xmin, ymax, xmax] = bubble.box;
        const x = (xmin / 1000) * canvas.width;
        const y = (ymin / 1000) * canvas.height;
        const w = ((xmax - xmin) / 1000) * canvas.width;
        const h = ((ymax - ymin) / 1000) * canvas.height;

        ctx.fillStyle = bubble.backgroundColor || "#FFFFFF";
        const radius = Math.min(w, h, 40) / 2;
        drawRoundedRect(ctx, x, y, w, h, radius);
        
        const scale = bubble.fontSizeScale || 1.0;
        let fontSize = Math.max(12, (Math.min(w, h) * 0.16) * scale);
        
        ctx.fillStyle = bubble.textColor || "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        if (isArabic) {
            ctx.direction = 'rtl';
        } else {
            ctx.direction = 'ltr';
        }

        const maxWidth = w * 0.90;
        const maxHeight = h * 0.90;
        const words = textToDraw.split(/\s+/);
        
        let lines: string[] = [];
        // الخط العربي يحتاج مسافة بين الأسطر أكبر
        let lineHeightFactor = isArabic ? 1.4 : 1.2;
        let lineHeight = fontSize * lineHeightFactor;

        while (fontSize > 6) {
          ctx.font = `bold ${fontSize}px ${isArabic ? "'Cairo'" : "'Inter'"}, sans-serif`;
          lineHeight = fontSize * lineHeightFactor;
          lines = [];
          let currentLine = '';

          for (let word of words) {
            let testLine = currentLine + (currentLine ? ' ' : '') + word;
            if (ctx.measureText(testLine).width > maxWidth && currentLine !== '') {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          lines.push(currentLine);

          const totalHeight = lines.length * lineHeight;
          if (totalHeight <= maxHeight) {
            break;
          }
          fontSize -= 1;
        }

        const startY = y + (h / 2) - ((lines.length - 1) * lineHeight / 2);

        lines.forEach((line, i) => {
          ctx.fillText(line, x + (w / 2), startY + (i * lineHeight));
        });
      }

      setTimeout(() => {
        canvas.toBlob((blob) => {
          if (!blob) {
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `comic-edit-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setIsExporting(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `comic-edit-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setIsExporting(false);
          }, 200);
        }, 'image/png', 1.0);
      }, 100);

    } catch (error) {
      console.error(error);
      alert("Failed to save image.");
      setIsExporting(false);
    }
  };

  const currentPage = pages[currentIndex];
  const selectedBubble = currentPage?.bubbles.find(b => b.id === selectedBubbleId);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <header className="h-16 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>
          </div>
          <div className="hidden sm:block">
            <h1 className="font-black text-lg tracking-tight uppercase">ComicEdit AI</h1>
            <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest leading-none">Manual Translation Overlay</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept="image/*" className="hidden" />
          
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="px-3 sm:px-4 py-2 hover:bg-white/5 rounded-xl text-xs sm:text-sm font-bold transition-all border border-white/5 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            <span className="hidden sm:inline">Upload</span>
          </button>

          {pages.length > 0 && (
            <button 
              onClick={exportCurrentPage} 
              disabled={isExporting}
              className={`px-3 sm:px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs sm:text-sm font-black shadow-xl shadow-blue-600/20 transition-all flex items-center gap-2 ${isExporting ? 'opacity-50 cursor-wait' : ''}`}
            >
              {isExporting ? 'Saving...' : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                  <span className="hidden sm:inline">Save Result</span>
                </>
              )}
            </button>
          )}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-white/5 bg-black/20 overflow-y-auto hidden md:block">
          <div className="p-5 space-y-4">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Workspace</h2>
            <div className="grid gap-4">
              {pages.map((page, idx) => (
                <button
                  key={page.id}
                  onClick={() => { setCurrentIndex(idx); setSelectedBubbleId(undefined); if(page.status === 'pending') processPage(idx); }}
                  className={`group relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all ${currentIndex === idx ? 'border-blue-500 scale-[1.02] shadow-2xl' : 'border-transparent opacity-40 hover:opacity-100'}`}
                >
                  <img src={page.url} className="w-full h-full object-cover" alt="" />
                  <div className="absolute bottom-2 left-2 text-[10px] font-bold">PAGE {idx + 1}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex-1 relative flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_#1e293b_0%,_#0f172a_100%)]">
          {currentPage ? (
            <div className="relative inline-block max-w-full max-h-full">
              <div className="relative shadow-[0_50px_100px_rgba(0,0,0,0.6)] rounded-2xl overflow-hidden border border-white/10">
                <img src={currentPage.url} className="max-w-full max-h-[80vh] object-contain block" alt="" />
                
                {currentPage.status === 'ready' && (
                  <BubbleOverlay 
                    bubbles={currentPage.bubbles} 
                    onSelect={handleBubbleSelect}
                    onTextUpdate={handleOverlayTextUpdate}
                    selectedId={selectedBubbleId}
                  />
                )}

                {selectedBubble && editorPos && (
                  <ControlPanel 
                    bubble={selectedBubble}
                    initialPosition={editorPos}
                    onClose={() => setSelectedBubbleId(undefined)}
                    onUpdate={(upd) => updateBubble(selectedBubble.id, upd)}
                  />
                )}
                
                {currentPage.status === 'analyzing' && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="font-black text-sm tracking-widest text-blue-400">DETECTING BUBBLES...</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-white/5 rounded-[40px] mx-auto flex items-center justify-center border-2 border-dashed border-white/10 animate-pulse">
                <svg className="w-10 h-10 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tighter">Edit Your Comics</h2>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">Manual translation with full Arabic support and high-quality fonts.</p>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="bg-white text-black hover:bg-slate-200 px-10 py-4 rounded-full font-black text-sm transition-all shadow-2xl">Start Editing</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
