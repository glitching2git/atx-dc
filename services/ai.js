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
    return true;
  }
  return false;
}

// Fastest available models first
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];

async function callAiWithFallback(prompt, systemInstruction = "") {
  let keyAttempts = 0;
  const maxKeyAttempts = Math.min(geminiKeys.length, 2);

  while (keyAttempts < maxKeyAttempts) {
    const ai = getAiClient();

    for (const model of MODEL_CANDIDATES) {
      try {
        const config = {};
        if (systemInstruction) config.systemInstruction = systemInstruction;

        // Fast race: 3.5s timeout to prevent Discord interaction expiration
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("MODEL_TIMEOUT")), 3500),
        );

        const apiPromise = ai.models.generateContent({
          model: model,
          contents: prompt,
          config: Object.keys(config).length > 0 ? config : undefined,
        });

        const response = await Promise.race([apiPromise, timeoutPromise]);

        if (response && response.text) {
          return response.text.trim();
        }
      } catch (err) {
        if (
          err.status === 429 ||
          err.status === 503 ||
          err.message === "MODEL_TIMEOUT"
        ) {
          continue;
        }
      }
    }

    const rotated = rotateKey();
    keyAttempts++;
    if (!rotated) break;
  }

  return null;
}

module.exports = { callAiWithFallback };
