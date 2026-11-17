// services/ai.js
const { GoogleGenAI } = require("@google/genai");

const geminiKeys = [
  process.env.GEMINI_API_KEY1,
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY2,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY,
].filter(Boolean);

let currentKeyIndex = 0;

function getAiClient() {
  const activeKey = geminiKeys[currentKeyIndex];
  if (!activeKey) {
    throw new Error("No Gemini API keys found in environment variables.");
  }
  return new GoogleGenAI({ apiKey: activeKey, apiVersion: "v1beta" });
}

function rotateKey() {
  if (geminiKeys.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length;
    console.log(
      `[KEY ROTATION] Switched to Gemini Key Index ${currentKeyIndex}`,
    );
    return true;
  }
  return false;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.1-pro-preview",
];

async function callAiWithFallback(
  prompt,
  systemInstruction = "",
  enableSearch = false,
) {
  let keyAttempts = 0;
  const maxKeyAttempts = Math.max(geminiKeys.length, 1);

  while (keyAttempts < maxKeyAttempts) {
    const ai = getAiClient();

    for (const model of MODEL_CANDIDATES) {
      try {
        const config = {};
        if (systemInstruction) config.systemInstruction = systemInstruction;
        if (enableSearch) config.tools = [{ googleSearch: {} }];

        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: Object.keys(config).length > 0 ? config : undefined,
        });

        if (response && response.text) {
          return response.text.trim();
        }
      } catch (err) {
        if (err.status === 429 || err.status === 503) {
          await sleep(500);
          continue;
        }
        if (err.status === 404) continue;
        console.warn(`[AI Engine] ${model} warning:`, err.message || err);
      }
    }

    const rotated = rotateKey();
    keyAttempts++;
    if (!rotated) break;
  }

  return null;
}

module.exports = { callAiWithFallback };
