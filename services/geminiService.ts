import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

// Initialize the client lazily or when key is available
const getClient = (): GoogleGenAI => {
  if (!aiClient) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("API Key is missing. Please select one.");
      throw new Error("API Key missing");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

export const generateHikingAdvice = async (
  userMessage: string,
  context: { location: string; route: string; teammates: string[] }
): Promise<string> => {
  try {
    const ai = getClient();
    
    // System instruction to act as a hiking guide
    const systemInstruction = `You are HikePal AI, an expert hiking guide for Hong Kong trails. 
    Current User Context:
    - Location: ${context.location}
    - Route: ${context.route}
    - Team status: Hiking with ${context.teammates.join(', ')}
    
    Provide concise, helpful safety and navigation advice. 
    If asked about toilets, water, or exit points (bailouts), be specific to the Dragon's Back / Cape D'Aguilar area.
    Keep responses short (under 100 words) as the user is currently hiking.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userMessage,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    return response.text || "Sorry, I couldn't get a clear signal on that.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm having trouble connecting to the network. Please check your signal.";
  }
};