import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Quote } from "../types";
import { FIXED_QUOTES } from "./quotesData";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const quoteSchema: Schema = {
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

// Helper to get a random key from FIXED_QUOTES
export const getRandomQuoteKey = (): string => {
  const keys = Object.keys(FIXED_QUOTES);
  if (keys.length === 0) return "1/1";
  const randomIndex = Math.floor(Math.random() * keys.length);
  return keys[randomIndex];
};

export const generateQuoteOfDay = async (date: Date): Promise<Quote> => {
  const dateString = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  
  // 1. Check if we have a fixed quote for this Month/Day in our database
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateKey = `${month}/${day}`;
  const fixedContent = FIXED_QUOTES[dateKey];

  // 2. IMPORTANT: If fixed content exists, use it DIRECTLY. Do NOT call AI.
  // This ensures the data is displayed exactly as entered by the user.
  if (fixedContent) {
    return {
      quote: fixedContent,
      author: "", // User requested to hide author
      meaning: "", // User requested to hide meaning
      tags: []    // User requested to hide tags
    };
  }

  // 3. Only if no data exists, fall back to AI generation
  const prompt = `
      Today is ${dateString}.
      Please act as a wise philosopher and curator.
      Provide a profound, inspiring, and unique quote suitable for today.
      The quote can be from famous historical figures, philosophers, writers, or successful modern leaders.
      Prefer quotes that are timeless and offer deep insight into life, success, happiness, or resilience.
      The response MUST be in Korean.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: quoteSchema,
        systemInstruction: "You are a wise mentor providing daily wisdom in Korean. Ensure the tone is polite, encouraging, and sophisticated.",
        temperature: 0.7, 
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
        throw new Error("Empty response from AI");
    }
    
    return JSON.parse(jsonText) as Quote;
  } catch (error) {
    console.error("Error generating quote:", error);
    // Fallback quote in case of API failure
    return {
      quote: "위대한 업적은 대개 커다란 희생을 치른 결과이다.",
      author: "",
      meaning: "",
      tags: []
    };
  }
};