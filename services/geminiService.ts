import { GoogleGenAI, Type } from "@google/genai";
import { LevelConfig } from "../types";

// Fallback config in case of API failure or default start
export const DEFAULT_LEVEL_CONFIG: LevelConfig = {
  themeName: "Neon Basic",
  missionDescription: "Survive the initial wave. Keep moving.",
  enemyColor: "#ef4444", // Red-500
  enemySpeed: 1.5, // Slower default
  enemySpawnRate: 2000, // Slower spawn (2s)
  playerColor: "#3b82f6", // Blue-500
  playerSpeed: 4,
  bulletColor: "#eab308", // Yellow-500
  backgroundColor: "#0f172a", // Slate-900
};

const getApiKey = (): string | undefined => {
  try {
    // Check if process is defined (Node.js/Webpack/etc)
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore errors accessing process
  }
  return undefined;
};

export const generateLevelConfig = async (prompt: string): Promise<LevelConfig> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn("No API Key found, using default config");
    return DEFAULT_LEVEL_CONFIG;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const systemInstruction = `
      You are a game designer for a top-down 2D shooter. 
      Your goal is to generate balanced but thematic game configuration parameters based on a user's prompt.
      
      Constraints:
      - Colors should be valid hex codes.
      - Enemy Speed: 0.5 (shambling) to 3 (moderate).
      - Player Speed: 3 (slow) to 8 (fast).
      - Enemy Spawn Rate: 1500 (intense) to 5000 (relaxed).
      - Keep the background color dark for contrast.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a level configuration for the theme: "${prompt}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            themeName: { type: Type.STRING },
            missionDescription: { type: Type.STRING },
            enemyColor: { type: Type.STRING },
            enemySpeed: { type: Type.NUMBER },
            enemySpawnRate: { type: Type.NUMBER },
            playerColor: { type: Type.STRING },
            playerSpeed: { type: Type.NUMBER },
            bulletColor: { type: Type.STRING },
            backgroundColor: { type: Type.STRING },
          },
          required: [
            "themeName", "missionDescription", "enemyColor", "enemySpeed", 
            "enemySpawnRate", "playerColor", "playerSpeed", "bulletColor", "backgroundColor"
          ],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as LevelConfig;
    }
    
    throw new Error("Empty response from AI");

  } catch (error) {
    console.error("Failed to generate level config:", error);
    return DEFAULT_LEVEL_CONFIG;
  }
};