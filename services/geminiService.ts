
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * تحليل الصفحة لاستخراج أماكن الفقاعات والنصوص الأصلية والألوان.
 * يتم الاحتفاظ بهذه الوظيفة لأنها أساسية لتحديد أماكن الكتابة.
 */
export const analyzeComicPage = async (base64Image: string): Promise<AnalysisResult> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: `OCR & Bubble Detection: Identify all text bubbles. For each bubble, detect its original background color and text color. 
            Return JSON: {"bubbles": [{"text": "...", "box_2d": [ymin, xmin, ymax, xmax], "background_color": "hex_code", "text_color": "hex_code"}]}. 
            Use 0-1000 scale for boxes.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bubbles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                box_2d: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                },
                background_color: { type: Type.STRING },
                text_color: { type: Type.STRING },
              },
              required: ["text", "box_2d"],
            },
          },
        },
        required: ["bubbles"],
      },
    },
  });

  try {
    const text = response.text;
    return JSON.parse(text || '{"bubbles": []}') as AnalysisResult;
  } catch (e) {
    console.error("Analysis failed", e);
    return { bubbles: [] };
  }
};

// تم حذف وظائف translateText و translateBatchTexts لتقليل استهلاك الكوتا بناءً على طلب المستخدم.
