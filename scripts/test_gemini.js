import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function testGemini() {
  console.log("Testing Gemini API accessibility...");
  try {
    // Model name used in the app's service
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const prompt = "Translate '你好，世界' to English. Just the translation.";
    const result = await model.generateContent(prompt);
    const response = await result.response;
    console.log("Gemini Response:", response.text().trim());
    return true;
  } catch (error) {
    console.error("Gemini API Test Failed:", error.message);
    return false;
  }
}

testGemini();