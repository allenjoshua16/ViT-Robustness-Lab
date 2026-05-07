import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ClassificationResult {
  label: string;
  confidence: number;
  explanation: string;
  topK: { label: string; confidence: number }[];
}

export interface AttentionMapData {
  patches: {
    x: number;
    y: number;
    importance: number; // 0 to 1
  }[];
  summary: string;
}

const safeJsonParse = (text: string | undefined) => {
  if (!text) throw new Error("Empty response from AI");
  try {
    const cleaned = text.replace(/^```json\n?/, '').replace(/n?```$/, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON response from Gemini:", e);
    console.error("Raw response text:", text);
    throw new Error("The AI model returned an invalid response format. Please try again.");
  }
};

export const analyzeImage = async (base64Image: string): Promise<ClassificationResult> => {
  const prompt = `Analyze this image as a Vision Transformer (ViT). 
  Provide the primary classification label, a confidence score (0-1), a brief explanation of why the model might classify it this way, and the top 3 alternative classes.
  Return as JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          explanation: { type: Type.STRING },
          topK: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                confidence: { type: Type.NUMBER }
              }
            }
          }
        },
        required: ["label", "confidence", "explanation", "topK"]
      }
    }
  });

  return safeJsonParse(response.text);
};

export const getAttentionMap = async (base64Image: string): Promise<AttentionMapData> => {
  const prompt = `Divide this image into an 8x8 grid of patches. For each patch, estimate its 'attention importance' (0 to 1) for the classification of the main object.
  Return a flat array of 64 patch objects with x, y coordinates and importance values.
  Also provide a brief summary of which regions the ViT is 'attending' to most.
  Return as JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          patches: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.INTEGER },
                y: { type: Type.INTEGER },
                importance: { type: Type.NUMBER }
              }
            }
          },
          summary: { type: Type.STRING }
        },
        required: ["patches", "summary"]
      }
    }
  });

  return safeJsonParse(response.text);
};

export const simulateAttack = async (base64Image: string, attackType: string, epsilon: number): Promise<ClassificationResult> => {
  const prompt = `Simulate an adversarial attack (${attackType}) on this image with epsilon=${epsilon}.
  How would a Vision Transformer's classification change? 
  Give me the new label (it should ideally be incorrect/misleading if epsilon is high), the new confidence, and an explanation of the adversarial effect.
  Return as JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          explanation: { type: Type.STRING },
          topK: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                confidence: { type: Type.NUMBER }
              }
            }
          }
        },
        required: ["label", "confidence", "explanation", "topK"]
      }
    }
  });

  return safeJsonParse(response.text);
};
