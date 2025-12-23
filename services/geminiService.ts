import { GoogleGenAI, Type } from "@google/genai";
import { Quote } from "../types";
import { FIXED_QUOTES } from "./quotesData";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Fix: Removed Schema type annotation as it is deprecated. Defining schema as a plain object using 'Type' from @google/genai.
const quoteSchema = {
  type: Type.OBJECT,
  properties: {
    quote: {
      type: Type.STRING,
      description: "The inspiring quote in Korean.",
    },
    author: {
      type: Type.STRING,
      description: "The name of the author.",
    },
    meaning: {
      type: Type.STRING,
      description: "A brief, 1-2 sentence explanation of the quote's meaning and how to apply it, in Korean.",
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-3 keywords related to the quote (e.g., 'Love', 'Success', 'Patience').",
    },
  },
  required: ["quote", "author", "meaning", "tags"],
};

export const getRandomQuoteKey = (): string => {
  const keys = Object.keys(FIXED_QUOTES);
  if (keys.length === 0) return "1/1";
  const randomIndex = Math.floor(Math.random() * keys.length);
  return keys[randomIndex];
};

export const generateQuoteOfDay = async (date: Date): Promise<Quote> => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateKey = `${month}/${day}`;
  const fixedContent = FIXED_QUOTES[dateKey];

  // Priority 1: Use Fixed Database
  if (fixedContent) {
    return {
      quote: fixedContent,
      author: "",
      meaning: "",
      tags: []
    };
  }

  // Priority 2: AI Generation as Fallback
  const dateString = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const prompt = `
      Today is ${dateString}.
      Provide a profound, inspiring Korean quote.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Updated to the latest recommended model
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: quoteSchema,
        systemInstruction: "You are a wise mentor providing daily wisdom in Korean. Keep it sophisticated and brief.",
        temperature: 0.7, 
      },
    });

    // Fix: Access .text property directly, do not call it as a method.
    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response");
    
    return JSON.parse(jsonText) as Quote;
  } catch (error) {
    console.error("Error generating quote:", error);
    return {
      quote: "위대한 업적은 대개 커다란 희생을 치른 결과이다.",
      author: "",
      meaning: "",
      tags: []
    };
  }
};