
export interface ComicPage {
  id: string;
  url: string;
  name: string;
  file: File;
  bubbles: SpeechBubble[];
  status: 'pending' | 'analyzing' | 'ready' | 'error';
}

export interface SpeechBubble {
  id: string;
  originalText: string;
  translatedText?: string;
  modifiedText?: string;
  box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  lang: 'en' | 'ar';
  fontSizeScale?: number;
  backgroundColor?: string; // لون خلفية الفقاعة (مثلاً #ffffff)
  textColor?: string;       // لون الخط (مثلاً #000000)
}

export interface AnalysisResult {
  bubbles: Array<{
    text: string;
    box_2d: [number, number, number, number];
    background_color?: string;
    text_color?: string;
  }>;
}
