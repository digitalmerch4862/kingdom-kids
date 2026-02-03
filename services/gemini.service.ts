
import { GoogleGenAI, Type } from "@google/genai";

export class FaceService {
  static async generateEmbedding(base64Image: string): Promise<number[]> {
    if (!process.env.API_KEY) {
      console.error("API_KEY is missing in process.env");
      // Fallback for demo without key
      return Array.from({ length: 128 }, () => Math.random());
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Remove header if present to get pure base64
      const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

      // Fix: Structure contents with parts array for multi-part request
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64
              }
            },
            { text: "Generate a unique 128-float array representation (embedding) of the person's face in this image. Ensure the output is JUST a JSON array of 128 floats." }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from Gemini");
      
      const arr = JSON.parse(text);
      
      if (!Array.isArray(arr)) throw new Error("Gemini did not return an array");
      
      // Normalize to 128 length
      const resultArr = arr.slice(0, 128).map(v => typeof v === 'number' ? v : 0);
      while (resultArr.length < 128) resultArr.push(0);
      
      return resultArr;
    } catch (error) {
      console.error("Embedding Generation Error:", error);
      // Return a random embedding as fallback to prevent crash during demo/offline
      return Array.from({ length: 128 }, () => Math.random());
    }
  }

  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(vecA.length, vecB.length);
    for (let i = 0; i < len; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return isNaN(similarity) ? 0 : similarity;
  }
}

export class GeminiService {
  static async getStudentAdvice(points: number, rank: number, ageGroup: string, name: string): Promise<string> {
    if (!process.env.API_KEY) return "KEEP SHINING FOR JESUS! (ADD API KEY TO ENABLE AI ADVICE)";

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `You are a friendly and encouraging mentor for a child in 'Kingdom Kids' church ministry. 
        The child, ${name}, has ${points} points and is ranked #${rank} in the ${ageGroup} age group. 
        Give 3 short, specific, fun, and biblical tips on how they can earn more points 
        (like memorizing verses, helping others, being early, or participation) and grow in their faith. 
        Keep the output in ALL CAPS, very positive, and kid-friendly (short sentences).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      return response.text || "KEEP SHINING FOR JESUS! YOU ARE DOING AMAZING!";
    } catch (e) {
      console.error("Advice Generation Error:", e);
      return "KEEP ATTENDING AND MEMORIZING VERSES TO CLIMB THE LEADERBOARD!";
    }
  }
}
