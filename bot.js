// bot.js
require("dotenv").config();
const http = require("http");

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Process Guard] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Process Guard] Uncaught Exception:", error);
});

// ==========================================
// RENDER KEEP-ALIVE HTTP SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "online",
      service: "ATX Discord Bot",
      platoBot: "Starza by arez",
      website: "https://atx-family.onrender.com",
    }),
  );
});
server.listen(PORT, () => {
  console.log(`[HTTP KEEP-ALIVE] Listening on port ${PORT}`);
});

const mongoose = require("mongoose");
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ComponentType,
  Events,
} = require("discord.js");
const { GoogleGenAI } = require("@google/genai");

const DiscordUser = require("./models/DiscordUser");
const DiscordActivity = require("./models/DiscordActivity");

// 1. Database Connection
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
mongoose
  .connect(mongoUri)
  .then(() => console.log("[DATABASE] Connected to DB"))
  .catch((err) => console.error("[DATABASE ERROR]", err));

// 2. Multi-Key Gemini Rotation Manager
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

// 3. Client Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const activeGames = new Map(); // channelId -> { type, answer, round, timer }
const GAME_TIMEOUT_MS = 2 * 60 * 1000;

const EMOJIS = {
  atx: "⚔️",
  bid: "🪙",
  auction: "🏛️",
  timer: "⏱️",
  love: "💖",
  alert: "🚨",
  trophy: "🏆",
  sparkles: "✨",
  terminal: "💻",
  shield: "🛡️",
};

// ==========================================
// DB HELPERS
// ==========================================
async function getOrCreateDiscordUser(author, member) {
  try {
    const safeUsername = author?.username || "Unknown User";
    const safeDisplayName =
      member?.displayName || author?.globalName || safeUsername;

    return await DiscordUser.findOneAndUpdate(
      { discordId: author.id },
      {
        $set: {
          username: safeUsername,
          displayName: safeDisplayName,
          tag: author?.tag || safeUsername,
          avatarUrl: author?.displayAvatarURL
            ? author.displayAvatarURL()
            : null,
          isStaff:
            member?.permissions?.has(PermissionFlagsBits.ManageMessages) ||
            member?.permissions?.has(PermissionFlagsBits.Administrator) ||
            false,
          "chatStats.lastActiveAt": new Date(),
        },
        $inc: { "chatStats.messageCount": 1 },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
  } catch (err) {
    console.error("[DB USER UPSERT ERROR]", err);
    return null;
  }
}

async function logActivity({
  author,
  channel,
  guild,
  activityType,
  details = {},
  metadata = {},
}) {
  try {
    await DiscordActivity.create({
      discordId: author.id,
      username: author.tag || author.username || "Unknown",
      activityType,
      channelId: channel?.id || "DM",
      channelName: channel?.name || "DM",
      guildId: guild ? guild.id : null,
      details,
      metadata,
    });
  } catch (err) {
    console.error("[DB ACTIVITY LOG ERROR]", err);
  }
}

// ==========================================
// RESILIENT AI CALLER
// ==========================================
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

// ==========================================
// GAME ENGINE
// ==========================================
async function generateAiGameData(type) {
  try {
    if (type === "unscramble") {
      const topics = [
        "technology",
        "internet",
        "AI",
        "popular games",
        "consoles",
        "esports",
        "world affairs",
        "geography",
        "famous cities",
        "space exploration",
        "sports",
        "athletics",
        "tournaments",
        "world championships",
        "science",
        "modern gadgets",
        "robotics",
        "cyber security",
      ];
      const selectedTopic = topics[Math.floor(Math.random() * topics.length)];

      let word = null;
      const res = await callAiWithFallback(
        `Generate ONE random, common, recognizable single English word between 6 and 8 letters related to: ${selectedTopic}.
Rules:
- Strictly letters only (A-Z). No spaces, hyphens, or proper names of people.
- Return strictly valid JSON: {"word": "EXAMPLE"}. No extra text or markdown.`,
      );

      if (res) {
        try {
          const parsed = JSON.parse(res.replace(/```json|```/g, "").trim());
          const candidate = parsed.word
            ?.toUpperCase()
            .replace(/[^A-Z]/g, "")
            .trim();
          if (candidate && candidate.length >= 5 && candidate.length <= 9) {
            word = candidate;
          }
        } catch (e) {}
      }

      if (!word) {
        const fallbackPool = [
          "CYBER",
          "SATELLITE",
          "ROBOT",
          "NETWORK",
          "CIRCUIT",
          "GALAXY",
          "BROWSER",
          "SERVER",
          "CHAMPION",
          "STADIUM",
          "PYTHON",
          "CRYPTO",
          "KEYBOARD",
          "DATABASE",
          "MONITOR",
          "RADAR",
          "AVATAR",
          "STREAM",
          "GLITCH",
          "CONSOLE",
          "TITAN",
          "QUANTUM",
          "ROCKET",
          "ARENA",
        ];
        word = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
      }

      const shuffle = (str) => {
        const arr = str.split("");
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join("");
      };

      let scrambled = shuffle(word);
      let attempts = 0;
      while (scrambled === word && attempts < 10) {
        scrambled = shuffle(word);
        attempts++;
      }

      return {
        answer: word,
        embed: new EmbedBuilder()
          .setColor(0x00f3ff)
          .setTitle(`🧠 Decrypt the Scrambled Word`)
          .setDescription(
            [
              ``,
              `# ${scrambled}`,
              ``,
              `> ${EMOJIS.timer} **Time Remaining:**  <t:${Math.floor((Date.now() + GAME_TIMEOUT_MS) / 1000)}:R>`,
              `> ${EMOJIS.bid} **Round Bounty:**  \` +50 EP \``,
              ``,
              `-# **Type your answer directly in chat!**`,
              `-# \`!stopgame\` or \`/stopgame\` to cancel.`,
            ].join("\n"),
          )
          .setFooter({ text: "Unscramble • ATX" }),
      };
    }

    if (type === "emojigame") {
      const domainPools = [
        {
          category: "Movie / Franchise",
          seeds: [
            "Titanic",
            "Jurassic Park",
            "Pirates of the Caribbean",
            "Avatar",
            "The Matrix",
            "Toy Story",
            "Star Wars",
            "Inception",
            "The Lion King",
            "Finding Nemo",
          ],
        },
        {
          category: "Superhero / Character",
          seeds: [
            "Iron Man",
            "Batman",
            "Spider-Man",
            "Goku",
            "Pikachu",
            "Naruto",
            "Sherlock Holmes",
            "Darth Vader",
            "Captain America",
            "Thor",
          ],
        },
        {
          category: "Popular Video Game",
          seeds: [
            "Minecraft",
            "Grand Theft Auto",
            "Super Mario",
            "Pac Man",
            "Subway Surfers",
            "Among Us",
            "Fortnite",
            "Clash of Clans",
            "Temple Run",
            "Angry Birds",
          ],
        },
        {
          category: "Iconic Personality",
          seeds: [
            "Albert Einstein",
            "Cristiano Ronaldo",
            "Lionel Messi",
            "Michael Jackson",
            "Neil Armstrong",
            "William Shakespeare",
            "Elon Musk",
            "Usain Bolt",
          ],
        },
      ];

      const domain =
        domainPools[Math.floor(Math.random() * domainPools.length)];
      const candidateChoices = domain.seeds
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      let puzzle = null;
      const res = await callAiWithFallback(
        `Choose ONE item from this list: [${candidateChoices.join(", ")}].
Create a clear, universally recognized "Guess the ${domain.category}" emoji riddle for it.
Strict Rules:
- Provide exactly 3 or 4 emojis that literally and unmistakably represent the chosen subject.
- Return strictly valid JSON: {"emojis": "EMOJIS", "answer": "Exact Name", "category": "${domain.category}"}. No extra text or markdown.`,
      );

      if (res) {
        try {
          const parsed = JSON.parse(res.replace(/```json|```/g, "").trim());
          if (parsed.emojis && parsed.answer) {
            puzzle = {
              emojis: parsed.emojis.trim(),
              answer: parsed.answer.trim(),
              category: parsed.category || domain.category,
            };
          }
        } catch (e) {}
      }

      if (!puzzle) {
        const fallbacks = [
          {
            emojis: "🧠👴💡",
            answer: "Albert Einstein",
            category: "Iconic Personality",
          },
          {
            emojis: "🚢🧊🌊",
            answer: "Titanic",
            category: "Movie / Franchise",
          },
          {
            emojis: "🦖🏝️🚙",
            answer: "Jurassic Park",
            category: "Movie / Franchise",
          },
          {
            emojis: "⛏️🧱🧟",
            answer: "Minecraft",
            category: "Popular Video Game",
          },
          {
            emojis: "🏎️🍌🍄",
            answer: "Super Mario",
            category: "Popular Video Game",
          },
          {
            emojis: "🕷️🕸️🏙️",
            answer: "Spider-Man",
            category: "Superhero / Character",
          },
          {
            emojis: "🦇🃏🏙️",
            answer: "Batman",
            category: "Superhero / Character",
          },
          {
            emojis: "⚡👓🦉",
            answer: "Harry Potter",
            category: "Superhero / Character",
          },
        ];
        puzzle = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }

      return {
        answer: puzzle.answer,
        embed: new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle(`🧩 Guess the **${puzzle.category}**`)
          .setDescription(
            [
              ``,
              `# \` ${puzzle.emojis} \``,
              ``,
              `> ${EMOJIS.timer} **Time Limit:** <t:${Math.floor((Date.now() + GAME_TIMEOUT_MS) / 1000)}:R>`,
              `> ${EMOJIS.bid} **Bounty:** \` +50 EP \``,
              ``,
              `-# **TYPE YOUR ANSWER DIRECTLY IN CHAT!**`,
              `-# \`/stopgame\` or \`!stopgame\` to cancel.`,
            ].join("\n"),
          )
          .setFooter({ text: `Guess It • ATX` }),
      };
    }

    if (type === "fasttype") {
      const themes = [
        "famous dialogue",
        "gaming victory slogans",
        "internet memes",
        "speed typing challenges",
        "action quotes",
      ];
      const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

      let phrase = null;
      const res = await callAiWithFallback(
        `Generate ONE short, catchy, fast-typing sentence related to: ${selectedTheme}.
Strict Rules:
- Length: Between 4 and 8 words strictly.
- Format: Lowercase letters and single spaces ONLY.
- Absolutely NO punctuation (no dots, commas, apostrophes, quotes, or dashes).
- Return strictly valid JSON: {"phrase": "your words here"}. No markdown or commentary.`,
      );

      if (res) {
        try {
          const parsed = JSON.parse(res.replace(/```json|```/g, "").trim());
          if (parsed.phrase) {
            const cleaned = parsed.phrase
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, "")
              .replace(/\s+/g, " ")
              .trim();
            const wordCount = cleaned.split(" ").length;
            if (wordCount >= 3 && wordCount <= 8) phrase = cleaned;
          }
        } catch (e) {}
      }

      if (!phrase) {
        const fallbackPhrases = [
          "strike hard before the timer ends",
          "atx plato family champions",
          "weekly auction is now live",
          "checkmate victory royale in the arena",
          "claim the ep balance and win",
          "super fast fingers win the prize",
          "lag is just an excuse for losing",
        ];
        phrase =
          fallbackPhrases[Math.floor(Math.random() * fallbackPhrases.length)];
      }

      return {
        answer: phrase,
        embed: new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle(`⚡ First to type this exact phrase wins`)
          .setDescription(
            [
              ``,
              `## \`\`\`${phrase}\`\`\``,
              ``,
              `> ${EMOJIS.timer} **Time Remaining:** <t:${Math.floor((Date.now() + GAME_TIMEOUT_MS) / 1000)}:R>`,
              `> ${EMOJIS.bid} **Round Bounty:** \` +50 EP \``,
              ``,
              `-# **Type directly in chat!**`,
              `-# Capitalization is ignored.`,
              `-# \`!stopgame\` or \`/stopgame\` to cancel.`,
            ].join("\n"),
          )
          .setFooter({ text: "Fast Type • ATX" }),
      };
    }

    if (type === "quiz") {
      const quizCategories = [
        {
          name: "World History",
          topic: "ancient civilizations, empires, and pivotal events",
        },
        {
          name: "Geography & Nature",
          topic: "world capitals, famous landmarks, and oceans",
        },
        {
          name: "Cinema & Pop Culture",
          topic: "blockbuster movies, iconic characters, and directors",
        },
        {
          name: "Technology & Space",
          topic: "computing, astronomy, and modern gadgets",
        },
        {
          name: "General Science",
          topic: "chemistry elements, biology, and inventions",
        },
      ];

      const difficulties = [
        {
          level: "Easy",
          desc: "common knowledge, instantly recognizable fact",
        },
        {
          level: "Moderate",
          desc: "interesting trivia requiring solid general knowledge",
        },
        { level: "Hard", desc: "challenging trivia that tests real mastery" },
      ];

      const selectedCategory =
        quizCategories[Math.floor(Math.random() * quizCategories.length)];
      const selectedDifficulty =
        difficulties[Math.floor(Math.random() * difficulties.length)];

      let qData = null;
      const res = await callAiWithFallback(
        `Generate ONE ${selectedDifficulty.level} trivia question about ${selectedCategory.name} (${selectedCategory.topic}).
Strict Rules:
- The question must be concise and clear.
- The answer MUST be strictly 1 or 2 words maximum (a name, place, object, or term).
- Return strictly valid JSON: {"question": "What is the capital of Australia?", "answer": "Canberra", "category": "${selectedCategory.name}", "difficulty": "${selectedDifficulty.level}"}. No markdown.`,
      );

      if (res) {
        try {
          const parsed = JSON.parse(res.replace(/```json|```/g, "").trim());
          if (parsed.question && parsed.answer) {
            const cleanAnswer = parsed.answer
              .replace(/[^a-zA-Z0-9\s]/g, "")
              .trim();
            if (cleanAnswer.split(" ").length <= 3) {
              qData = {
                question: parsed.question.trim(),
                answer: cleanAnswer,
                category: parsed.category || selectedCategory.name,
                difficulty: parsed.difficulty || selectedDifficulty.level,
              };
            }
          }
        } catch (e) {}
      }

      if (!qData) {
        const fallbacks = [
          {
            question: "Who was the first Emperor of the Roman Empire?",
            answer: "Augustus",
            category: "World History",
            difficulty: "Moderate",
          },
          {
            question: "In which year did the Titanic sink?",
            answer: "1912",
            category: "World History",
            difficulty: "Easy",
          },
          {
            question: "What is the capital city of Australia?",
            answer: "Canberra",
            category: "Geography & Nature",
            difficulty: "Moderate",
          },
          {
            question: "What is the longest river in South America?",
            answer: "Amazon",
            category: "Geography & Nature",
            difficulty: "Easy",
          },
          {
            question: "Which director directed Inception and Oppenheimer?",
            answer: "Christopher Nolan",
            category: "Cinema & Pop Culture",
            difficulty: "Easy",
          },
          {
            question: "What is the chemical symbol for Gold?",
            answer: "Au",
            category: "General Science",
            difficulty: "Easy",
          },
        ];
        qData = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }

      const difficultyBadges = {
        Easy: "🟢 Easy",
        Moderate: "🟡 Moderate",
        Hard: "🔴 Hard",
      };

      return {
        answer: qData.answer.trim(),
        embed: new EmbedBuilder()
          .setColor(0xa855f7)
          .setTitle(`❓ Quiz • ${qData.category}`)
          .setDescription(
            [
              `**Difficulty:** ${difficultyBadges[qData.difficulty] || "🟡 Moderate"}`,
              ``,
              `> **${qData.question}**`,
              ``,
              `> ${EMOJIS.timer} **Time Remaining:** <t:${Math.floor((Date.now() + GAME_TIMEOUT_MS) / 1000)}:R>`,
              `> ${EMOJIS.bid} **Bounty:** \` +50 EP \``,
              ``,
              `-# **Type the answer directly in chat**`,
              `-# \`/stopgame\` or \`!stopgame\` to cancel.`,
            ].join("\n"),
          )
          .setFooter({ text: `Trivia • ATX` }),
      };
    }
  } catch (err) {
    return {
      answer: "ACCELERATE",
      embed: new EmbedBuilder()
        .setColor(0x00f3ff)
        .setTitle("🎮 ATX Game Backup")
        .setDescription(
          "Unscramble this word: **`ALATECRACE`**\nTime: 2 Minutes!",
        ),
    };
  }
}

async function launchNextRound(channel, type, round = 1) {
  if (activeGames.has(channel.id)) {
    clearTimeout(activeGames.get(channel.id).timer);
  }

  const gameData = await generateAiGameData(type);
  const commandTitle = type ? type.toUpperCase() : "ARENA";

  const timer = setTimeout(async () => {
    if (activeGames.has(channel.id)) {
      const currentGame = activeGames.get(channel.id);
      activeGames.delete(channel.id);

      const timeoutEmbed = new EmbedBuilder()
        .setColor(0xff0055)
        .setAuthor({
          name: `${commandTitle} • TIMEOUT`,
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTitle("⏰ Round Timed Out!")
        .setDescription(
          [
            `Nobody was able to solve it within 2 minutes!`,
            ``,
            `> 💡 **Correct Answer:** \` ${currentGame.answer} \``,
            `> 🏁 **Final Round Reached:** \` ${currentGame.round} \``,
            ``,
            `-# Start new round with \`/${type}\` or \`!${type}\``,
          ].join("\n"),
        )
        .setFooter({ text: "Type !help for more commands" });
      await channel.send({ embeds: [timeoutEmbed] }).catch(() => {});
    }
  }, GAME_TIMEOUT_MS);

  activeGames.set(channel.id, {
    type,
    answer: gameData.answer,
    round,
    timer,
  });

  gameData.embed.setAuthor({
    name: `${commandTitle} • ROUND - ${round}`,
    iconURL: client.user?.displayAvatarURL(),
  });

  await channel.send({ embeds: [gameData.embed] });
}

// ==========================================
// PAGINATED HELP EMBEDS BUILDER
// ==========================================
function getHelpPages(userAvatar) {
  const safeAvatar = userAvatar || undefined;
  return [
    new EmbedBuilder()
      .setColor(0x00f3ff)
      .setTitle(`${EMOJIS.atx} Welcome to the ATX Discord AI`)
      .setDescription(
        [
          `All commands work with both **\`/\`** (Slash) and **\`!\`** (Prefix).`,
          ``,
          `### 🛰️ Module Breakdown`,
          `> **🤖 • AI Intelligence**`,
          `> **🎮 • Continuous Games**`,
          `> **🎭 • Social & Fun**`,
          `> **🎂 • Profiles & Privacy**`,
          ``,
          `-# Login to [**Our Website**](https://atx-family.onrender.com/)`,
        ].join("\n"),
      )
      .setFooter({ text: "Page 1 of 5 • ATX", iconURL: safeAvatar }),

    new EmbedBuilder()
      .setColor(0x00d2ff)
      .setTitle(`🤖 AI Interaction Commands`)
      .setDescription(
        [
          `> \`/ai <prompt>\` or \`!ai\``,
          `> \`/eli5 <topic>\` or \`!eli5\``,
          `> \`/summary <time>\` or \`!summary\``,
          `> \`/translate <text>\` or \`!translate\``,
          `> \`/counter <statement>\` or \`!counter\``,
          `> \`/factcheck <claim>\` or \`!factcheck\``,
          `> \`/remind <time> <reminder>\` or \`!remind\``,
        ].join("\n"),
      )
      .setFooter({ text: "Page 2 of 5 • AI & Utilities", iconURL: safeAvatar }),

    new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(`🎮 Mini-Games & EP`)
      .setDescription(
        [
          `> \`/quiz\` or \`!quiz\``,
          `> \`/fasttype\` or \`!fasttype\``,
          `> \`/emojigame\` or \`!emojigame\``,
          `> \`/unscramble\` or \`!unscramble\``,
          `> \`/stopgame\` or \`!stopgame\``,
          ``,
          `**Reward:** Each successful answer grants **\` +50 EP \`**!`,
        ].join("\n"),
      )
      .setFooter({ text: "Page 3 of 5 • Mini-Games", iconURL: safeAvatar }),

    new EmbedBuilder()
      .setColor(0xff007f)
      .setTitle(`🎭 Social Meters, Banter & Fun`)
      .setDescription(
        [
          `> \`/joke\` or \`!joke\``,
          `> \`/excuse [target]\` or \`!excuse\``,
          `> \`/simp [target]\` or \`!simp\``,
          `> \`/wish [target]\` or \`!wish\``,
          `> \`/aura [target]\` or \`!aura\``,
          `> \`/truthdare\` or \`!truthdare\``,
          `> \`/tossacoin\` or \`!tossacoin\``,
          `> \`/roast [target]\` or \`!roast\``,
          `> \`/crush [target]\` or \`!crush\``,
          `> \`/flirt [target]\` or \`!flirt\``,
          `> \`/delulu [target]\` or \`!delulu\``,
          `> \`/expose [target]\` or \`!expose\``,
          `> \`/lovemeter <target>\` or \`!lovemeter\``,
        ].join("\n"),
      )
      .setFooter({
        text: "Page 4 of 5 • Social & Banter",
        iconURL: safeAvatar,
      }),

    new EmbedBuilder()
      .setColor(0x7928ca)
      .setTitle(`🎂 Identity, Privacy & Staff Center`)
      .setDescription(
        [
          `### 👤 Identity & Privacy`,
          `> \`/balance\` or \`!balance\``,
          `> \`/introduce\` or \`!introduce\``,
          `> \`/profile [target]\` or \`!profile\``,
          `> \`/welcome [target]\` or \`!welcome\``,
          `> \`/birthday [target]\` or \`!birthday\``,
          `> \`/setbirthday <DD/MM>\` or \`!setbirthday\``,
          `> \`/secret <message>\` or \`!secret\``,
          `> \`/report [target] [reason]\` or \`!report @user reason\``,
          ``,
        ].join("\n"),
      )
      .setFooter({ text: "Page 5 of 5 • Profile", iconURL: safeAvatar }),
  ];
}

// ==========================================
// UNIFIED COMMAND EXECUTOR (CORE ROUTING)
// ==========================================
async function executeCommand({
  commandName,
  author,
  member,
  channel,
  guild,
  args,
  targetUser,
  textInput,
  numberInput,
  reply,
  deleteOriginal,
}) {
  await getOrCreateDiscordUser(author, member);

  const isStaff =
    member?.permissions?.has(PermissionFlagsBits.ManageMessages) ||
    member?.permissions?.has(PermissionFlagsBits.Administrator);

  // 1. HELP COMMAND
  if (commandName === "help") {
    let currentPage = 0;
    const pages = getHelpPages(client.user?.displayAvatarURL());

    const getRow = (idx) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("help_prev")
          .setLabel("◀ Prev")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(idx === 0),
        new ButtonBuilder()
          .setCustomId("help_next")
          .setLabel("Next ▶")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(idx === pages.length - 1),
        new ButtonBuilder()
          .setCustomId("help_close")
          .setLabel("✖ Close")
          .setStyle(ButtonStyle.Danger),
      );

    const helpMsg = await reply({
      embeds: [pages[currentPage]],
      components: [getRow(currentPage)],
      fetchReply: true,
    });

    const collector = helpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
    });
    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== author.id) {
        return interaction.reply({
          content: "⚠️ Open your own help menu with `/help`!",
          ephemeral: true,
        });
      }
      if (interaction.customId === "help_prev")
        currentPage = Math.max(0, currentPage - 1);
      else if (interaction.customId === "help_next")
        currentPage = Math.min(pages.length - 1, currentPage + 1);
      else if (interaction.customId === "help_close")
        return collector.stop("user_closed");

      await interaction.update({
        embeds: [pages[currentPage]],
        components: [getRow(currentPage)],
      });
    });

    collector.on("end", async (_, reason) => {
      if (reason === "user_closed") {
        await helpMsg.delete().catch(() => {});
      } else {
        const disabled = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("1")
            .setLabel("◀ Prev")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("2")
            .setLabel("Next ▶")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        );
        await helpMsg.edit({ components: [disabled] }).catch(() => {});
      }
    });
    return;
  }

  // 2. PROFILE & BALANCE
  if (commandName === "profile" || commandName === "balance") {
    const target = targetUser || author;
    const profile = await DiscordUser.findOne({ discordId: target.id });
    if (!profile)
      return reply("No profile initialized yet. Chat in the server first!");

    const safeAuthorName = (target.username || "ATX MEMBER").toUpperCase();
    const userAvatar = target.displayAvatarURL
      ? target.displayAvatarURL()
      : undefined;
    const botAvatar = client.user?.displayAvatarURL
      ? client.user.displayAvatarURL()
      : undefined;

    const msgCount = profile.chatStats?.messageCount || 0;
    const level = Math.floor(Math.sqrt(msgCount / 5)) + 1;
    const progressXP = msgCount % 50;
    const progressBar =
      "█".repeat(Math.floor(progressXP / 5)) +
      "░".repeat(10 - Math.floor(progressXP / 5));

    const embed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: `PROFILE  •  ${safeAuthorName}`,
        iconURL: userAvatar,
      })
      .setThumbnail(userAvatar || null)
      .setDescription(
        [
          ``,
          `> Rank Status: **${profile.isStaff ? "🛡️ Staff" : "😎 Member"}**`,
          ``,
          `**Level ${level} Progress** \`[${progressBar}]\` *(${progressXP * 2}%)*`,
          `─────────────────────────────────`,
          `💰 **Bot EP Balance:** \` ${(profile.botBalance || 0).toLocaleString()} EP \``,
          `💬 **Messages Dispatched:** \` ${msgCount.toLocaleString()} \``,
          `🤖 **AI Interactions:** \` ${(profile.chatStats?.aiPromptsCount || 0).toLocaleString()} \``,
          `🎮 **Mini-Games Played:** \` ${(profile.gameStats?.totalGamesPlayed || 0).toLocaleString()} \``,
          `🎂 **Birthday Record:** \` ${profile.metadata?.birthday || "Not set"} \``,
          `─────────────────────────────────`,
          `-# Tip: Participate in **Mini Games** to earn +50 EP every round.`,
        ].join("\n"),
      )
      .setFooter({
        text: `User ID: ${profile.discordId}`,
        iconURL: botAvatar,
      });

    return reply({ embeds: [embed] });
  }

  // 3. AI CHAT
  if (commandName === "ai") {
    const prompt = textInput || args.join(" ").trim();
    if (!prompt)
      return reply("Need assistance? Provide a prompt or explore `/help`!");

    const replyText = await callAiWithFallback(
      prompt,
      [
        'You are the "ATX Assistant", the refined digital caretaker of "ATX Family" — the premier gaming community on the Plato Fun Multiplayer Games app.',
        "",
        "CORE PERSONA & TONE:",
        "- Maintain a professional, gaming-savvy, polished demeanor with an italicized, formal touch.",
        "- Jump straight into your answer in sentence one without generic filler.",
        "",
        "DIRECTIVE & PROTOCOL RULES:",
        '1. COMPLAINTS: Direct grievances to "Accelerate" or any server Admin.',
        "2. WEBSITE & PORTAL: Visit https://atx-family.onrender.com or reach out to server Admins.",
        "3. BROAD KNOWLEDGE: Provide sharp, accurate answers on sports, current events, weather, technology, gaming meta, and general trivia.",
        "4. LENGTH & FORMATTING: Keep response concise and under 4-6 sentences using Discord markdown.",
      ].join("\n"),
      true,
    );

    const final =
      replyText ||
      "😭 **Sollyyy...** AI link momentarily offline. Please re-engage shortly!\n\n-# You can play Mini Games on our **website**, see you there 🥳";

    await DiscordUser.updateOne(
      { discordId: author.id },
      { $inc: { "chatStats.aiPromptsCount": 1 } },
    );

    return reply(final.length > 2000 ? final.slice(0, 1990) + "..." : final);
  }

  // 4. SUMMARY OF PAST FEW HOURS
  if (commandName === "summarise" || commandName === "summary") {
    const hours = numberInput || parseInt(args[0]) || 3;
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;

    await channel.sendTyping().catch(() => {});

    try {
      const fetched = await channel.messages.fetch({ limit: 100 });
      const recentMessages = fetched
        .filter(
          (m) =>
            !m.author.bot &&
            m.createdTimestamp >= cutoffTime &&
            m.content.trim().length > 0,
        )
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map(
          (m) => `[${m.author.displayName || m.author.username}]: ${m.content}`,
        );

      if (recentMessages.length < 4) {
        return reply(
          `📡 *Radar is clear — not enough chat activity in the last ${hours} hour(s) to form a debrief.*`,
        );
      }

      const transcript = recentMessages.join("\n").slice(0, 4000);

      const summaryPrompt = [
        `You are ATX Bot, the official resident bot and caretaker of the ATX Plato server.`,
        `Summarize the chat activity from the past ${hours} hours into a crisp, engaging server debrief.`,
        ``,
        `Include these exact sections:`,
        `### 🛰️ The Narrative`,
        `(2-3 concise sentences capturing key conversations, themes, and community vibe)`,
        ``,
        `### ⚔️ Highlights & Banter`,
        `(3-4 clear bullet points: main topics, games played, jokes, debates, or announcements)`,
        ``,
        `### 👑 Active Members`,
        `(List the most active participants in bold)`,
        ``,
        `CHAT TRANSCRIPT:`,
        transcript,
      ].join("\n");

      const debrief = await callAiWithFallback(summaryPrompt);

      if (!debrief) {
        return reply(
          "😭 **Sollyyy...** Could not compile server summary at this moment. Please try again shortly!",
        );
      }

      const summaryEmbed = new EmbedBuilder()
        .setColor(0x00f3ff)
        .setTitle(`🛰️ Summary • Past ${hours} Hours`)
        .setDescription(
          debrief.length > 4000 ? debrief.slice(0, 3990) + "..." : debrief,
        )
        .setFooter({ text: "ATX Automated Recap" })
        .setTimestamp();

      return reply({ embeds: [summaryEmbed] });
    } catch (err) {
      console.error("[SUMMARISE ERROR]", err);
      return reply(
        "😭 **Sollyyy...** Encountered an internal error while fetching channel history!",
      );
    }
  }

  // STANDARD TEXT UTILITIES (eli5, factcheck, translate)
  if (["eli5", "factcheck", "translate"].includes(commandName)) {
    const query = textInput || args.join(" ").trim();
    if (!query)
      return reply(`Please provide text: \`/${commandName} <content>\``);

    let instruction = "";
    if (commandName === "eli5")
      instruction =
        "Explain this simply for a 5-year old in 4-5 sentences with proper and accurate facts:";
    if (commandName === "factcheck")
      instruction =
        "Verify this claim. Label it TRUE, FALSE, or MISLEADING with a brief reason:";
    if (commandName === "translate")
      instruction = "Translate the following text into both English and Hindi:";

    const res = await callAiWithFallback(`${instruction}\n\n${query}`);
    const embed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setTitle(`${commandName.toUpperCase()}`)
      .setDescription(
        res
          ? res.length > 2000
            ? res.slice(0, 1990) + "..."
            : res
          : "Unable to produce output at this time.",
      )
      .setFooter({ text: "Use !help for more commands" });

    return reply({ embeds: [embed] });
  }

  if (commandName === "counter") {
    const stmt = textInput || args.join(" ").trim();
    if (!stmt) {
      return reply(
        "Provide an argument to counter! Example: `/counter statement:Plato pool requires no skill` or `!counter Plato pool requires no skill`",
      );
    }

    const res = await callAiWithFallback(
      [
        `A member in a competitive gaming Discord server said: "${stmt}".`,
        "Formulate a sharp, witty, fact-checked, and logical counter-argument challenging this exact claim.",
        "Rules:",
        "- Length: 2 to 3 sentences maximum.",
        "- Tone: Eloquent, confident, sarcastic, and intellectually superior.",
        "- Do NOT use robotic assistant phrases. Jump straight into the rebuttal.",
      ].join("\n"),
    );

    const rebuttalText =
      res?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
      "That premise completely collapses under empirical examination and basic competitive reality.";

    const counterEmbed = new EmbedBuilder()
      .setColor(0xff0055)
      .setAuthor({
        name: "COUNTER • LOGICAL REBUTTAL",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("Tactical Counter-Argument")
      .setDescription(
        [
          `### 🗣️ Opposing Statement`,
          `> *" ${stmt.length > 250 ? stmt.slice(0, 247) + "..." : stmt} "*`,
          ``,
          `### 🛡️ Debunk & Refutation`,
          `> ${rebuttalText}`,
          ``,
          `-# Argued on behalf of: **${author}**`,
        ].join("\n"),
      )
      .setFooter({ text: "Use !help for more commands" });

    return reply({ embeds: [counterEmbed] });
  }

  if (commandName === "remind") {
    const timeArg = args[0]?.trim();
    const reminderText = args.slice(1).join(" ")?.trim();

    if (!timeArg || !reminderText) {
      return reply(
        "Usage:\n> Prefix: `!remind 5m plato tournament`\n> Slash: `/remind time:5m reminder:plato tournament`",
      );
    }

    const match = timeArg.match(/^(\d+)([smh])$/i);
    if (!match) {
      return reply(
        "😭 **Eeee...** Invalid duration format! Use `10s` (seconds), `5m` (minutes), or `2h` (hours).",
      );
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    let ms = amount * 1000;
    if (unit === "m") ms *= 60;
    if (unit === "h") ms *= 3600;

    if (ms <= 0 || ms > 2147483647) {
      return reply(
        "😭 Reminder duration must be between 1 second and 24 days.",
      );
    }

    const scheduledEmbed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: "ATX REMINDER",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `### ⏰ Reminder Initialized!`,
          `> **Task:** "${reminderText}"`,
          `> **Alarm In:** **${amount}${unit}**`,
        ].join("\n"),
      )
      .setFooter({ text: "Type !help for more commands ● ATX Services" });

    await reply({ embeds: [scheduledEmbed] });

    setTimeout(async () => {
      const alarmEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("🔔 Alarm Triggered!")
        .setDescription(
          [
            `Hey ${author}, your scheduled reminder is up:`,
            ``,
            `> **"${reminderText}"**`,
          ].join("\n"),
        )
        .setFooter({ text: "Type !help for more commands" });

      await channel
        .send({ content: `${author}`, embeds: [alarmEmbed] })
        .catch(() => {});
    }, ms);

    return;
  }

  // 5. SOCIAL METERS & BANTER
  if (commandName === "roast" || commandName === "flirt") {
    const target = targetUser || author;
    const isSelf = target.id === author.id;
    const targetName = target.username;

    let aiPrompt = "";
    let systemPersona = "";

    if (commandName === "roast") {
      aiPrompt = isSelf
        ? `Roast ${author.username} who asked to be roasted themselves. Mock their self-pity and lack of attention.`
        : `Deliver an elite, ruthless, and hilarious roast directed personally at ${targetName}.
Reference their real life struggles, being single forever, gaming skill issues, embarrassing choke moments, excessive confidence with zero trophies, or absolute bot-like existence in Discord and Plato.`;

      systemPersona = [
        "You are an elite, savage roast comic inspired by the sharp sarcasm of Samay Raina and the raw punch of CarryMinati.",
        "RULES:",
        "- Output strictly ONE or TWO punchy sentences maximum.",
        "- Address the victim directly ('You...').",
        "- Make it witty, sharp, unexpected, and devastatingly funny without using slurs or hateful content.",
        "- No preamble, no quotes, no 'Here is your roast:'. Jump straight into the punchline.",
      ].join("\n");
    } else {
      aiPrompt = isSelf
        ? `Deliver an ego-boosting, ultra-charming, smooth flirt line to ${author.username}.`
        : `Deliver a high-level, irresistibly smooth, witty, and charming flirt line directed to ${targetName}.`;

      systemPersona = [
        "You are an OG master of rizz and romance — smooth, magnetic, poetic, and effortlessly witty.",
        "RULES:",
        "- Output strictly ONE smooth, charming line (1-2 sentences maximum).",
        "- Speak directly with bold confidence, razor-sharp wit, and magnetic presence.",
        "- No quotation marks, no preamble, no robotic chatter.",
      ].join("\n");
    }

    const line = await callAiWithFallback(aiPrompt, systemPersona);
    const cleaned =
      line?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
      (commandName === "roast"
        ? `${targetName}, even the AI refused to roast you because your gameplay already does the job.`
        : `${targetName}, you're the kind of distraction that makes losing an entire win streak feel worth it.`);

    const isRoast = commandName === "roast";

    const embed = new EmbedBuilder()
      .setColor(isRoast ? 0xff3b30 : 0xff2d55)
      .setAuthor({
        name: isRoast ? "ATX SAVAGE ROAST 🔥" : "ATX HIGH-TIER RIZZ 💘",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription([`> **${cleaned}**`].join("\n"))
      .setFooter({
        text: isRoast
          ? "React funny at it • No Hard Feelings"
          : "Smoooooth like butter • React or Die",
      });

    return reply({ content: `${target}`, embeds: [embed] });
  }

  if (commandName === "lovemeter") {
    const target = targetUser;
    if (!target) {
      return reply(
        "Mention someone to test your compatibility! Use `/lovemeter target:@user` or `!lovemeter @user`",
      );
    }

    if (target.id === author.id) {
      return reply(
        "Self-love is important, but pick another member to test real chemistry! 😉",
      );
    }

    const daySeed = new Date().toISOString().slice(0, 10);
    const combinedIds = [author.id, target.id].sort().join("") + daySeed;
    let hash = 0;
    for (let i = 0; i < combinedIds.length; i++) {
      hash = (hash << 5) - hash + combinedIds.charCodeAt(i);
      hash |= 0;
    }
    const percent = Math.abs(hash) % 101;

    const filledHearts = Math.round(percent / 10);
    const emptyHearts = 10 - filledHearts;
    const progressBar = "💖".repeat(filledHearts) + "🖤".repeat(emptyHearts);

    let color = 0xff2d55;
    let statusTitle = "";
    let fallbackVerdict = "";

    if (percent >= 90) {
      statusTitle = "💍 Soulmates Destined By Fate";
      fallbackVerdict =
        "Absolute peak compatibility! Start planning the wedding and locking in duo queues.";
      color = 0xff007f;
    } else if (percent >= 70) {
      statusTitle = "🔥 Passionate High-Voltage Chemistry";
      fallbackVerdict =
        "Solid dynamic with unmatched mutual vibes. A power couple in the making.";
      color = 0xff2d55;
    } else if (percent >= 45) {
      statusTitle = "✨ Playful Banter & Friendship";
      fallbackVerdict =
        "Strong foundation with occasional chaotic friction. Worth exploring!";
      color = 0xff9500;
    } else if (percent >= 20) {
      statusTitle = "🧊 Dangerous Cold Front";
      fallbackVerdict =
        "Friction detected. Stick to friendly discord arguments and maintain distance.";
      color = 0x5856d6;
    } else {
      statusTitle = "☠️ Catastrophic System Failure";
      fallbackVerdict =
        "Zero romantic telemetry. Even the Plato algorithm refuses to match this duo.";
      color = 0x8e8e93;
    }

    const aiVerdictPrompt = `Generate a witty, dramatic, and entertaining 1-2 sentence compatibility verdict for two Discord members: ${author.username} and ${target.username}.
Their calculated compatibility is ${percent}% (${statusTitle}).
Rules:
- Address both of them or their dynamic directly.
- Tailor the tone strictly to their score.
- Output ONLY the raw verdict text without quotation marks.`;

    const aiRes = await callAiWithFallback(
      aiVerdictPrompt,
      "You are the ATX Love Oracle. Deliver only the witty compatibility verdict.",
    );

    const verdict =
      aiRes?.replace(/^["'\s]+|["'\s]+$/g, "").trim() || fallbackVerdict;

    const loveEmbed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: "ATX CUPID RADAR",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `### **${author.username}**  ×  **${target.username}**`,
          ``,
          `# Compatibility: \` ${percent}% \` `,
          `${progressBar}`,
          ``,
          `### 🔮 Oracle Verdict`,
          `> *${verdict}*`,
          ``,
        ].join("\n"),
      )
      .setFooter({ text: "Love Meter • Scores refresh every 24 hours" });

    return reply({ content: `${author} 💕 ${target}`, embeds: [loveEmbed] });
  }

  if (["simp", "delulu", "aura"].includes(commandName)) {
    const target = targetUser || author;

    const daySeed = new Date().toISOString().slice(0, 10);
    const seedString = `${target.id}_${commandName}_${daySeed}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      hash = (hash << 5) - hash + seedString.charCodeAt(i);
      hash |= 0;
    }
    const positiveHash = Math.abs(hash);

    let embed = new EmbedBuilder();

    if (commandName === "simp") {
      const score = positiveHash % 101;
      const filled = Math.round(score / 10);
      const bar = "🥺".repeat(filled) + "🖤".repeat(10 - filled);

      let statusTitle = "";
      let color = 0xff758f;
      let defaultPunchline = "";

      if (score >= 80) {
        statusTitle = "👑 Down Horrendous / Master Simp";
        color = 0xff0055;
        defaultPunchline =
          "Would literally apologize if someone else stepped on their foot.";
      } else if (score >= 50) {
        statusTitle = "💌 Chronic Softie / High Simp";
        color = 0xff758f;
        defaultPunchline =
          "Replies to DMs in 0.2 seconds and overuses heart emojis.";
      } else if (score >= 25) {
        statusTitle = "🛡️ Balanced Casual";
        color = 0xffb3c1;
        defaultPunchline =
          "Cares just enough to keep it friendly, but won't lose sleep over anyone.";
      } else {
        statusTitle = "🗿 Cold Stone / Zero Simp";
        color = 0x6c757d;
        defaultPunchline =
          "Heart made of pure tungsten. Leaves everyone on read without flinching.";
      }

      const prompt = `Generate ONE savage or funny punchline (strictly 1 sentence) roasting or reviewing ${target.username}'s Simp meter score of ${score}% (${statusTitle}).
Rules: Speak directly about them. Sarcastic, funny, no quotes, no intros.`;

      const aiLine = await callAiWithFallback(
        prompt,
        "You are a witty Discord comic.",
      );
      const punchline =
        aiLine?.replace(/^["'\s]+|["'\s]+$/g, "").trim() || defaultPunchline;

      embed
        .setColor(color)
        .setAuthor({
          name: "ATX SIMP EVALUATION",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          [
            ``,
            `# Simp Rating: \` ${score}% \` `,
            `> ${bar}`,
            `### ||${statusTitle}||`,
            ``,
            `### 🔬 Behavioral Diagnosis`,
            `> **${punchline}**`,
            ``,
          ].join("\n"),
        )
        .setFooter({ text: "Diagnostic metrics refresh daily at midnight" });

      return reply({ content: `${target}`, embeds: [embed] });
    }

    if (commandName === "delulu") {
      const score = positiveHash % 101;
      const solulu = 100 - score;
      const filled = Math.round(score / 10);
      const bar = "🦄".repeat(filled) + "🧠".repeat(10 - filled);

      let statusTitle = "";
      let color = 0xa855f7;
      let defaultPunchline = "";

      if (score >= 80) {
        statusTitle = "🌌 Living In A Parallel Universe";
        color = 0x9333ea;
        defaultPunchline =
          "Believes eye contact for 0.5 seconds means marriage is imminent.";
      } else if (score >= 50) {
        statusTitle = "🦄 Hopeful Dreamer / Certified Delulu";
        color = 0xc084fc;
        defaultPunchline =
          "Blames Mercury retrograde for missed skill shots in Plato.";
      } else if (score >= 25) {
        statusTitle = "⚖️ Grounded With Occasional Daydreams";
        color = 0x38bdf8;
        defaultPunchline =
          "Knows reality is harsh, but keeps a small delusion alive for fun.";
      } else {
        statusTitle = "📐 Hardcore Realist / Maximum Solulu";
        color = 0x22c55e;
        defaultPunchline =
          "Zero imagination. Calculates tax brackets while playing games.";
      }

      const prompt = `Generate ONE witty, funny 1-sentence commentary on ${target.username}'s Delusion score of ${score}% (Solulu: ${solulu}%).
Tone: Internet culture humor. No quotes, no intro.`;

      const aiLine = await callAiWithFallback(
        prompt,
        "You are a witty internet culture observer.",
      );
      const punchline =
        aiLine?.replace(/^["'\s]+|["'\s]+$/g, "").trim() || defaultPunchline;

      embed
        .setColor(color)
        .setAuthor({
          name: "ATX DELULU LABS",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          [
            ``,
            `# Delulu Level: \` ${score}% \` `,
            `> ${bar}`,
            `> Solulu Level (Realism): **\` ${solulu}% \`**`,
            `### ||${statusTitle}||`,
            ``,
            `### 🔮 Reality Distortion`,
            `> **${punchline}**`,
            ``,
          ].join("\n"),
        )
        .setFooter({ text: "Delulu index recalibrates every 24 hours" });

      return reply({ content: `${target}`, embeds: [embed] });
    }

    if (commandName === "aura") {
      const isPositive = positiveHash % 2 === 0;
      const rawPoints = (positiveHash * 13) % 100001;
      const auraPoints = isPositive ? rawPoints : -rawPoints;

      let statusTitle = "";
      let color = 0x00f3ff;
      let bar = "";
      let defaultPunchline = "";

      if (auraPoints >= 50000) {
        statusTitle = "👑 Transcendent Divine Aura (+MAX)";
        color = 0xffd700;
        bar = "✨✨✨✨✨✨✨✨✨✨";
        defaultPunchline =
          "Enters the voice channel and everyone instinctively sits up straight.";
      } else if (auraPoints > 0) {
        statusTitle = "⚡ High Roller / Main Character Aura";
        color = 0x00f3ff;
        bar = "⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡";
        defaultPunchline = "Walks away from explosions without looking back.";
      } else if (auraPoints > -50000) {
        statusTitle = "📉 Stumbling / Minor Aura Deficit";
        color = 0xf97316;
        bar = "💀💀💀💀💀⬛⬛⬛⬛⬛";
        defaultPunchline =
          "Waved back at someone who was actually waving at the person behind them.";
      } else {
        statusTitle = "🕳️ Black Hole Debt / Negative Infinite Aura";
        color = 0xef4444;
        bar = "💀💀💀💀💀💀💀💀💀💀";
        defaultPunchline =
          "Tripped on a flat surface and apologized to the pavement.";
      }

      const formattedAura =
        auraPoints > 0
          ? `+${auraPoints.toLocaleString()}`
          : `${auraPoints.toLocaleString()}`;

      const prompt = `Generate ONE short, funny 1-sentence comment explaining why ${target.username} has an Aura rating of ${formattedAura} (${statusTitle}).
Tone: Modern gamer and internet slang. No quotes, no intro.`;

      const aiLine = await callAiWithFallback(
        prompt,
        "You are an expert on meme culture and Aura scores.",
      );
      const punchline =
        aiLine?.replace(/^["'\s]+|["'\s]+$/g, "").trim() || defaultPunchline;

      embed
        .setColor(color)
        .setAuthor({
          name: "ATX AURA SCANNER",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          [
            `# \` ${formattedAura} \` Aura Points`,
            `> ${bar}`,
            `### ||${statusTitle}||`,
            ``,
            `### 📡 Aura Incident Report`,
            `> **${punchline}**`,
            ``,
          ].join("\n"),
        )
        .setFooter({
          text: "Aura balances fluctuate daily based on spiritual presence",
        });

      return reply({ content: `${target}`, embeds: [embed] });
    }
  }

  if (commandName === "crush" || commandName === "expose") {
    const target = targetUser || author;

    const daySeed = new Date().toISOString().slice(0, 10);
    const seed = `${target.id}_${commandName}_${daySeed}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const randIndex = Math.abs(hash);

    let embed = new EmbedBuilder();

    if (commandName === "crush") {
      let candidateNames = [];
      if (guild && guild.members?.cache?.size > 0) {
        candidateNames = guild.members.cache
          .filter((m) => !m.user.bot && m.id !== target.id)
          .map((m) => m.displayName || m.user.username);
      }

      const celebrityCrushes = [
        "Chris Evans",
        "Michael B. Jordan",
        "Timothée Chalamet",
        "Pedro Pascal",
        "Henry Cavill",
        "Tom Hiddleston",
        "Zendaya",
        "Margot Robbie",
        "Ana de Armas",
        "Florence Pugh",
        "Tom Holland",
        "Cillian Murphy",
        "Sydney Sweeney",
        "Dua Lipa",
        "Sabrina Carpenter",
        "Kiara Advani",
        "Triptii Dimri",
        "Rashmika Mandanna",
        "Mrunal Thakur",
        "Disha Patani",
        "Samantha Ruth Prabhu",
        "Virat Kohli",
        "Shubman Gill",
        "Smriti Mandhana",
        "Hrithik Roshan",
        "Ranbir Kapoor",
        "Charles Leclerc",
        "Jenna Ortega",
        "Kartik Aaryan",
        "Alia Bhatt",
      ];

      let chosenCrush = "";
      if (candidateNames.length >= 3 && randIndex % 2 === 0) {
        chosenCrush = candidateNames[randIndex % candidateNames.length];
      } else {
        chosenCrush = celebrityCrushes[randIndex % celebrityCrushes.length];
      }

      const prompt = `Write a hilarious, spicy, and flirtatious gossip punchline revealing that ${target.username} has a massive, desperate crush on "${chosenCrush}".
Rules:
- Length: Strictly 1 or 2 punchy sentences.
- Tone: Teasing, witty, and dramatic like a high-energy group chat leak.
- Output strictly the punchline text. No quotes, no intro.`;

      const aiLine = await callAiWithFallback(
        prompt,
        "You are the server's sharpest gossip comic.",
      );
      const fallbackCrushLines = [
        `Caught rehearsing wedding vows in the mirror every night before opening their DMs.`,
        `Was seen refreshing ${chosenCrush}'s status every 4 minutes hoping for a miracle reply.`,
        `Secretly bookmarked all their photos and claims they're just 'studying camera angles'.`,
      ];
      const punchline =
        aiLine?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
        fallbackCrushLines[randIndex % fallbackCrushLines.length];

      embed
        .setColor(0xff007f)
        .setAuthor({
          name: "GOSSIP LEAK • SECRET CRUSH",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          [
            `### 💌 Secret Crush: **||${chosenCrush}||**`,
            ``,
            `> *${punchline}*`,
            ``,
            `> 🔍 **Obsession Level:** \` ${(randIndex % 45) + 55}% \``,
            `> 🤫 **Source:** \` Unfiltered Gossips \``,
            ``,
            `-# **Gossip telemetry recalculates daily at midnight**`,
          ].join("\n"),
        )
        .setFooter({ text: "ATX Cupid Watch • No Love with Love" });

      return reply({ content: `${target}`, embeds: [embed] });
    }

    if (commandName === "expose") {
      const now = new Date();
      const hourSeed = `${now.toISOString().slice(0, 10)}-${String(now.getUTCHours()).padStart(2, "0")}`;
      const seedExp = `${target.id}_expose_${hourSeed}`;
      let hashExp = 0;
      for (let i = 0; i < seedExp.length; i++) {
        hashExp = (hashExp << 5) - hashExp + seedExp.charCodeAt(i);
        hashExp |= 0;
      }
      const hourIndex = Math.abs(hashExp);

      const historicalBlunders = [
        "Loris Karius gifting Real Madrid goals in the 2018 Champions League final",
        "Ferrari's F1 pit-stop strategy clown shows",
        "Steve Harvey announcing the wrong Miss Universe winner on live global TV",
        "South Africa finding brand new mathematical ways to choke in ICC World Cup knockouts",
        "The Titanic lookouts declaring the ship unsinkable while ignoring ice warnings",
        "FC Barcelona blowing a 3-0 lead against Liverpool at Anfield",
        "Will Smith crashing the stage at the Oscars",
        "The meme guy checking out another girl while holding his girlfriend's hand",
        "The infamous CrowdStrike blue-screen outage crashing global systems",
        "Manchester United conceding 7-0 to Liverpool",
        "NASA losing a $125 million Mars climate orbiter due to a metric-to-imperial conversion error",
        "Lance Stroll suddenly turning into a wall and asking who hit him",
      ];
      const selectedBlunder =
        historicalBlunders[hourIndex % historicalBlunders.length];

      const prompt = `Deliver an elite, comedic roast comparing gamer ${target.username}'s skills/life/decision-making to this real-world disaster/fail: "${selectedBlunder}".
Rules:
- Length: Strictly 1 to 2 sentences.
- Tone: Savage stand-up comedian style (like Samay Raina or CarryMinati).
- No quotes, no intro. Jump straight into the punchline.`;

      const aiLine = await callAiWithFallback(
        prompt,
        "You are an elite roast comedian.",
      );
      const fallbackFails = [
        `Their decision-making makes Ferrari's F1 strategy team look like Nobel Prize winners.`,
        `Watching them play under pressure is like watching Loris Karius in a Champions League final—pure tragedy with zero defense.`,
        `They choke leads faster than South Africa in an ICC knockout match.`,
        `Their situational awareness is on par with the Titanic crew casually ignoring ice warnings.`,
      ];
      const punchline =
        aiLine?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
        fallbackFails[hourIndex % fallbackFails.length];

      embed
        .setColor(0xff3300)
        .setAuthor({
          name: "ATX DECLASSIFIED EXPOSED",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          [
            `### Exposing: **${target.username}**`,
            ``,
            `### 📁 Declassified Verdict`,
            `> *${punchline}*`,
            ``,
          ].join("\n"),
        )
        .setFooter({ text: "Hall of Shame • Emotional Damage Guaranteed" });

      return reply({ content: `${target}`, embeds: [embed] });
    }
  }

  if (commandName === "wish") {
    const target = targetUser || author;
    const customWishText =
      textInput && !textInput.startsWith("<@")
        ? textInput
        : args.length > (targetUser ? 1 : 0)
          ? args
              .slice(targetUser ? 1 : 0)
              .join(" ")
              .trim()
          : "";

    const now = new Date();
    const hourSeed = `${now.toISOString().slice(0, 10)}-${String(now.getUTCHours()).padStart(2, "0")}`;
    const seed = `${target.id}_wish_${hourSeed}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const hourIndex = Math.abs(hash);

    const wishThemes = [
      "unshakable win streaks, god-tier RNG, and flawless competitive clutch moments",
      "wealth, abundance of EP tokens, and triumphing in weekly high-roller auctions",
      "peak personal energy, conquering real-life battles, and ultimate good fortune",
      "invincible mental resilience, flawless ping, and zero server lag across every arena",
      "legendary aura, boundless happiness, and eternal respect within the ATX brotherhood",
    ];
    const selectedTheme = wishThemes[hourIndex % wishThemes.length];

    let finalWish = "";

    if (customWishText) {
      finalWish = customWishText;
    } else {
      const prompt = `Craft an inspiring, legendary, and heartening gamer blessing/wish for ${target.username}.
Theme: ${selectedTheme}.
Rules:
- Length: Strictly 1 to 2 sentences.
- Tone: Uplifting, epic, formal yet gaming-focused.
- Output ONLY the wish text. No quotation marks, no preamble.`;

      const aiWish = await callAiWithFallback(
        prompt,
        "You are the grand herald of the ATX Family.",
      );
      const fallbackWishes = [
        "May your win streaks stretch into infinity, your reaction times stay lightning-fast, and fortune favor every move you make.",
        "May your vaults overflow with EP, your auction bids land unchallenged, and every arena you grace remember your name.",
        "May your ping stay razor-sharp at single digits and the algorithm bend reality in your favor across every battlefield.",
        "May unmatched clarity guide your hands, every defeat turn into fuel, and your legacy in the ATX Family remain untouchable.",
      ];

      finalWish =
        aiWish?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
        fallbackWishes[hourIndex % fallbackWishes.length];
    }

    const wishEmbed = new EmbedBuilder()
      .setColor(0xffd700)
      .setAuthor({
        name: "ATX SACRED BLESSINGS",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `### **${target.username}**`,
          ``,
          `### 📜 Inscribed Blessing ✨`,
          `> **${finalWish}**`,
          ``,
        ].join("\n"),
      )
      .setFooter({ text: "May Fortune Favor the Brave" });

    return reply({ content: `${target}`, embeds: [wishEmbed] });
  }

  if (commandName === "joke") {
    const jokeAngles = [
      "Plato Ocho games where someone hoards +4 cards only to choke at the end",
      "toxic 1v1 Pool matches where a player scratches on the 8-ball",
      "blaming 999ms ping, phantom touch, and phone battery for clean losses",
      "Discord gamers who stay active 20 hours a day but miss one alarm in real life",
      "spending all your bot EP tokens on weekly auctions and ending up broke",
      "saying 'one last game and I sleep' at 3:00 AM on a weekday",
      "acting like an esports champion in a casual party mobile game",
      "rage-quitting a match and claiming the server disconnected",
    ];
    const randomAngle =
      jokeAngles[Math.floor(Math.random() * jokeAngles.length)];
    const uniqueNonce = Math.floor(Math.random() * 1000000);

    const prompt = `Tell ONE original, hilarious, and punchy gaming joke focused on: "${randomAngle}".
Context Reference ID: #${uniqueNonce}
Rules:
- Format: Deliver strictly as setup and punchline (1-2 short sentences).
- Style: Stand-up banter, relatable gamer pain, and witty irony.
- Output ONLY the joke text itself. No quotation marks, no intro.`;

    const aiJoke = await callAiWithFallback(
      prompt,
      "You are a quick-witted stand-up comedian.",
    );

    const offlineJokes = [
      "I told my squad I had an emergency and had to log off. The emergency was my pride after getting wiped in round one.",
      "My doctor told me to avoid stressful situations, so I uninstalled Plato for six minutes.",
      "I don't need an alarm clock. The emotional trauma of blowing an 8-ball shot keeps me awake 24/7.",
      "My internet isn't actually lagging. My brain is just buffering the defeat in high definition.",
      "They say money can't buy happiness, but it can buy enough EP to outbid everyone who laughed at you.",
      "I put 'strategic patience' on my resume because 'camped in a corner waiting for others to lose' sounded unprofessional.",
    ];

    const cleanJoke =
      aiJoke?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
      offlineJokes[Math.floor(Math.random() * offlineJokes.length)];

    const jokeEmbed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setAuthor({
        name: "ATX STANDUP",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription([`> **${cleanJoke}**`, ``].join("\n"))
      .setFooter({ text: "🎭 100% Organic Banter • Try /joke for more" });

    return reply({ embeds: [jokeEmbed] });
  }

  if (commandName === "tossacoin") {
    const isHeads = Math.random() < 0.5;
    const result = isHeads ? "Heads" : "Tails";
    const coinColor = isHeads ? 0xffd700 : 0x00f3ff;

    const tossEmbed = new EmbedBuilder()
      .setColor(coinColor)
      .setAuthor({
        name: "ATX COIN FLIP",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [`> The coin landed decisively on **${result.toUpperCase()}**`].join(
          "\n",
        ),
      )
      .setFooter({ text: "Provably Fair 50/50" });

    return reply({ embeds: [tossEmbed] });
  }

  if (commandName === "truthdare" || commandName === "td") {
    const target = targetUser || author;
    const rawMode = (textInput || args[0] || "").toLowerCase().trim();
    let mode = "";
    if (["t", "truth"].includes(rawMode)) mode = "TRUTH";
    else if (["d", "dare"].includes(rawMode)) mode = "DARE";
    else mode = Math.random() < 0.5 ? "TRUTH" : "DARE";

    const isTruth = mode === "TRUTH";

    const truthCategories = [
      "embarrassing gaming losses, toxic excuses, or rage-quitting habits",
      "secret Plato crushes, late-night DMs, or ghosting people",
      "biggest real-life lies told just to stay online and game",
      "spending money or obsessing over virtual clout and leaderboards",
    ];
    const dareCategories = [
      "changing Discord status or bio to something hilarious for 1 hour",
      "typing a ridiculous confession in chat without explaining why",
      "challenging the next person who talks to an immediate 1v1 on Plato",
      "sending an absurd voice note or public apology to another member",
    ];

    const pickedCategory = isTruth
      ? truthCategories[Math.floor(Math.random() * truthCategories.length)]
      : dareCategories[Math.floor(Math.random() * dareCategories.length)];

    const prompt = `Generate ONE original, spicy PG-13 ${mode} challenge directed at gamer ${target.username}.
Theme: ${pickedCategory}.
Rules:
- Length: Strictly 1 to 2 sentences maximum.
- Tone: Teasing, chaotic, and funny for a Discord gaming community.
- Output ONLY the prompt text. No quotes, no preamble.`;

    const aiLine = await callAiWithFallback(
      prompt,
      "You are the chaotic host of the ATX Truth or Dare arena.",
    );

    const fallbackTruths = [
      "What is the most pathetic excuse you've ever typed in chat after choking an easy win?",
      "Who in this server would you secretly hate losing to the most in a 1v1?",
      "Have you ever ghosted someone in real life just to finish a Plato win streak?",
      "What's the deepest rabbit hole you've fallen into stalking someone's Discord profile?",
    ];
    const fallbackDares = [
      "Set your custom status to 'Certified Bot • Coaching Needed' for the next 1 hour.",
      "Send a DM to the 3rd person in your direct messages saying 'We need to talk' and send no follow-up for 5 minutes.",
      "Ping any admin right now and ask them for permission to breathe in the server.",
      "Drop a 5-second voice note singing the chorus of any pop song or forfeit 50 EP.",
    ];

    const cleanLine =
      aiLine?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
      (isTruth
        ? fallbackTruths[Math.floor(Math.random() * fallbackTruths.length)]
        : fallbackDares[Math.floor(Math.random() * fallbackDares.length)]);

    const embed = new EmbedBuilder()
      .setColor(isTruth ? 0x00f3ff : 0xff0055)
      .setAuthor({
        name: `ATX ${mode}`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `### ${target.username}: ${isTruth ? "Moment of Truth 🤔" : "Dare Undertaking 🔥"}`,
          `> **${cleanLine}**`,
          ``,
          `> ⚖️ **Penalty:** \` Permanent Reputational Damage \``,
          ``,
          `-# **Refusal is an automatic admission of FEAR 🎭**`,
        ].join("\n"),
      )
      .setFooter({ text: `Lie or Die` });

    return reply({ embeds: [embed] });
  }

  if (commandName === "excuse") {
    const target = targetUser || author;
    const excuseAngles = [
      "999ms ping spike, packet loss, and phantom touch on the touchscreen",
      "an unexpected phone call from a random scammer right at the clutch moment",
      "low battery 20% pop-up notification blocking the entire screen during an 8-ball shot",
      "sunlight reflecting off the screen at a mathematically impossible angle",
      "the game server deliberately rigging RNG against them to protect the opponent",
      "their fingers slipping because their phone was slightly warm",
    ];
    const randomAngle =
      excuseAngles[Math.floor(Math.random() * excuseAngles.length)];
    const uniqueNonce = Math.floor(Math.random() * 1000000);

    const prompt = `Generate ONE absurd, hilarious, and embarrassingly creative gamer excuse explaining why ${target.username} just lost or choked a match.
Angle: ${randomAngle}.
ID: #${uniqueNonce}
Rules:
- Format: Deliver as a direct first-person quote from the player (1-2 sentences maximum).
- Tone: High-tier copium, dramatic, and visibly sweating with excuses.
- Output ONLY the excuse text. No quotation marks, no preamble.`;

    const aiExcuse = await callAiWithFallback(
      prompt,
      "You are the master of real life copium.",
    );

    const fallbackExcuses = [
      "My phone screen registered a ghost touch from humidity—I literally didn't even tap that!",
      "A 999ms lag spike froze my game right when I had a guaranteed win, but of course it caught up the second I lost.",
      "The 20% battery alert popped up right when I was lining up my final shot. That match was stolen from me.",
      "My little brother bumped my elbow from across the room. Review the match replay, that was not my fault!",
      "The Plato physics engine is clearly bugged on this patch. That angle goes in 100 out of 100 times.",
    ];

    const cleanExcuse =
      aiExcuse?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
      fallbackExcuses[Math.floor(Math.random() * fallbackExcuses.length)];

    const excuseEmbed = new EmbedBuilder()
      .setColor(0xff9500)
      .setAuthor({
        name: "EMERGENCY EXCUSE",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [`${target} be like...\n`, `> **${cleanExcuse}**`, `\n`].join("\n"),
      )
      .setFooter({ text: "It was purely a skill issue 🎭" });

    return reply({ content: `${target}`, embeds: [excuseEmbed] });
  }

  // 6. BIRTHDAYS & SECRETS
  if (commandName === "birthday") {
    const target = targetUser || author;
    const doc = await DiscordUser.findOne({ discordId: target.id });
    const bdayRaw = doc?.metadata?.birthday;

    const bdayEmbed = new EmbedBuilder()
      .setColor(bdayRaw ? 0xffa500 : 0x8e8e93)
      .setAuthor({
        name: "🎉🎂 ATX BIRTHDAYS",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        bdayRaw
          ? `## 🎂 ${target}'s Birthday:  \` ${bdayRaw} \``
          : `### 🎂 ${target}'s Birthday: *Not set yet* \n(Use  \` /setbirthday date:DD/MM \`)`,
      )
      .setFooter({ text: `Type /help for more commands` });

    return reply({ embeds: [bdayEmbed] });
  }

  if (commandName === "setbirthday") {
    const dateInput = (textInput || args[0] || "").trim();

    const match = dateInput.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (!match) {
      return reply(
        "⚠️ Please provide a valid date in `DD/MM` format (e.g., `/setbirthday date:15/08` or `!setbirthday 15/08`).",
      );
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);

    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
      return reply(
        `⚠️ \` ${dateInput} \` is not a valid calendar date! Please verify the day and month.`,
      );
    }

    const formattedDate = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;

    await DiscordUser.findOneAndUpdate(
      { discordId: author.id },
      { $set: { "metadata.birthday": formattedDate } },
      { upsert: true, returnDocument: "after" },
    );

    const embed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: "ATX BIRTHDAY REGISTRY",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        `> 🎂 Your birthday has been recorded as **\` ${formattedDate} \`**`,
      );

    return reply({ embeds: [embed] });
  }

  if (commandName === "secret") {
    const secretText = textInput || args.join(" ").trim();
    if (!secretText)
      return reply(
        "Usage: `/secret message:your secret confession` or `!secret <message>`",
      );

    if (deleteOriginal) await deleteOriginal().catch(() => {});

    const prompt = `A member anonymously confessed this in a Discord server: "${secretText}".
Rules:
- Formulate strictly ONE short, entertaining, and witty reaction/commentary (1-2 sentences maximum).
- Tone: Mysterious, gossipy, or playful server oracle.
- Do NOT repeat the secret itself. React to the drama level or consequences.
- No quotation marks, no preamble.`;

    const aiLine = await callAiWithFallback(
      prompt,
      "You are the Keeper of Secrets for ATX.",
    );

    const fallbackReactions = [
      "The walls of this server have ears, and this secret just shook them.",
      "A confession of this caliber belongs in the classified archives.",
      "The telemetry on this drama is off the charts.",
    ];

    const commentary =
      aiLine?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
      fallbackReactions[Math.floor(Math.random() * fallbackReactions.length)];

    const randCode = Math.floor(1000 + Math.random() * 9000);

    const secretEmbed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({
        name: "ATX CLASSIFIED ARCHIVE • ANONYMOUS TRANSMISSION",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🤫 Intercepted Confession")
      .setDescription(
        [
          `### 📁 Declassified Transcript`,
          `> *" ${secretText} "*`,
          ``,
          `### 🔮 The Oracle's Whisper`,
          `> *" ${commentary} "*`,
          ``,
          `> 🕵️ **Source:** \`Operative #${randCode} (Redacted)\``,
          `> 🔒 **Encryption:** \`256-Bit Quantum Zero-Knowledge\``,
          ``,
          `- # *Identity permanently scrubbed from server logs*`,
        ].join("\n"),
      )
      .setFooter({ text: "Confession Bureau • Speak Your Truth" })
      .setTimestamp();

    await channel.send({ embeds: [secretEmbed] });
    return reply(
      "🤫 *Your confession has been scrubbed and dispatched anonymously to the channel.*",
    );
  }

  // 7. MINI-GAMES LAUNCHER
  if (["unscramble", "emojigame", "fasttype", "quiz"].includes(commandName)) {
    if (activeGames.has(channel.id))
      return reply(
        "😭 Oiii... An arena game is already ongoing! Use `!stopgame` or `/stopgame` to cancel.",
      );
    await reply(`Starting **${commandName}**! Initializing round 1...`);
    await launchNextRound(channel, commandName, 1);
    return;
  }

  if (commandName === "stopgame") {
    if (!activeGames.has(channel.id))
      return reply("No game is currently active in this channel.");
    const cur = activeGames.get(channel.id);
    clearTimeout(cur.timer);
    activeGames.delete(channel.id);
    return reply(`🛑 Mini-game halted. The answer was **\`${cur.answer}\`**.`);
  }

  // 8. GENERAL & INTRODUCE
  if (commandName === "rules") {
    const embed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: "ATX SERVER RULES",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `Welcome to the **ATX Family**. To maintain an elite, respectful, and safe community, all members must adhere strictly to these core rules:`,
          ``,
          `### 1. Mutual Respect & Decency 🌟`,
          `> Treat every member with dignity. **Zero tolerance** for harassment, toxicity, abuse, slurs, or hate speech across text and voice channels.`,
          ``,
          `### 2. Anti-Spam & Chat Hygiene 🚫`,
          `> Keep channels clean and readable. Avoid message flooding, rapid emote spam, wall-of-text copy-pastes, or disruptive mentions.`,
          ``,
          `### 3. Strictly No NSFW Material 🔞`,
          `> Uploading, linking, or discussing adult, explicit, suggestive, or inappropriate content results in an **immediate and permanent ban**.`,
          ``,
          `### 4. Suspicious Links & Safety ⚠️`,
          `> Do not share unverified downloads, phishing portals, scam links, or malicious files. Automated link monitoring is strictly enforced.`,
          ``,
          `### 5. Advertising & Self-Promotion 📢`,
          `> Unauthorized promotion of other Discord servers, group chats, personal products, or commercial ventures is prohibited without admin approval.`,
          ``,
          `### 6. DM Etiquette & Privacy 🛡️`,
          `> Unsolicited DMs, predatory outreach, or harassing members in private messages will lead to an immediate server blacklist.`,
          ``,
          `-------`,
          `### Need to Report an Incident? 🚨`,
          `> Use \` /report target:@user reason:<details> \` or [**Report Anonymously**](https://atx-family.onrender.com/contact/) straight to the admins`,
          ``,
          `-# *Failure to comply may trigger warnings, mutes, kicks, or permanent expulsion.*`,
        ].join("\n"),
      )
      .setFooter({ text: "Server Rules • ATX Family" });

    return reply({ embeds: [embed] });
  }

  if (commandName === "introduce" || commandName === "about") {
    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setAuthor({
        name: "ATX CENTRAL HEADQUARTERS • CLASSIFIED DOSSIER",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🏛️ Welcome to the ATX Family")
      .setDescription(
        [
          `We are a premier gaming collective and competitive syndicate competing across Plato arenas, high-stakes tournaments, and exclusive community events.`,
          ``,
          `### 🌐 Ecosystem Pillars`,
          `> 💎 **Live Weekly Auctions**`,
          `> *Leverage your accumulated EP tokens to claim rare collectibles, custom badges, and exclusive prizes.*`,
          ``,
          `> ⚔️ **Competitive Battlegrounds**`,
          `> *Engage in round-the-clock Plato skirmishes, daily trivia challenges, and leaderboards.*`,
          ``,
          `> 🚀 **Official Web Operations**`,
          `> *Synchronize your account, inspect leaderboards, and manage your assets via the [**ATX Command Center**](https://atx-family.onrender.com/).*`,
          ``,
          `---`,
          `### 🔰 Getting Started`,
          `> 📜 Check our directives via \`/rules\``,
          `> 🎁 Claim starting rewards & track rank via \`/profile\``,
          `> 🎯 Challenge your squad in Plato & climb the hierarchy`,
          ``,
          `- # *Enter with honor. Play to conquer. Long live ATX.*`,
        ].join("\n"),
      )
      .setFooter({ text: "ATX Family • Established Brotherhood" })
      .setTimestamp();

    return reply({ embeds: [embed] });
  }

  if (commandName === "welcome") {
    const target = targetUser || author;

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: "ATX RECEPTION",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `Yooo! **${target.username}** has successfully joined the **ATX Family**`,
          ``,
          `> 📜 **Mandatory Briefing:** Review server laws with \` /rules \``,
          `> 💎 **Web Operations:** Login yourself on the [**Official Portal**](https://atx-family.onrender.com/)`,
          `> 💻 **Bot Commands:** Use \` /help \` to see all commands`,
          ``,
          `------`,
          `-# 💬 **Introduce yourself in chat, squad up for Plato battles, and make yourself at home!**`,
          ``,
        ].join("\n"),
      )
      .setFooter({ text: "ATX Reception • Enter with Honor, Play to Conquer" });

    return reply({ content: `🎉 ${target}`, embeds: [welcomeEmbed] });
  }

  if (commandName === "report") {
    const target = targetUser;
    const reason = textInput || args.slice(1).join(" ");
    if (!target || !reason)
      return reply("Usage: `/report target:@user reason:<reason>`");
    await logActivity({
      author,
      channel,
      guild,
      activityType: "MOD_INVITE_BLOCKED",
      details: { reportedUser: target.id, reason },
    });
    return reply(
      `🚨 Report logged against **${target.username}** for executive staff review.`,
    );
  }
}

// ==========================================
// EVENT LISTENERS
// ==========================================
client.once(Events.ClientReady, () => {
  console.log(`[DISCORD] ATX Bot is live and connected as ${client.user.tag}`);
  client.user.setActivity("ATX Discord Server 24/7 ⚔️", { type: 3 });
});

// Slash Command Handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const isSecret = interaction.commandName === "secret";
  await interaction.deferReply({ ephemeral: isSecret }).catch(() => {});

  const targetUser = interaction.options.getUser("target");
  const timeOption = interaction.options.getString("time");
  const reminderOption = interaction.options.getString("reminder");

  const textInput =
    interaction.options.getString("prompt") ||
    interaction.options.getString("topic") ||
    interaction.options.getString("text") ||
    interaction.options.getString("claim") ||
    interaction.options.getString("statement") ||
    reminderOption ||
    interaction.options.getString("idea") ||
    interaction.options.getString("reason") ||
    interaction.options.getString("message") ||
    interaction.options.getString("date");

  const numberInput =
    interaction.options.getInteger("count") ||
    interaction.options.getInteger("hours");

  await executeCommand({
    commandName: interaction.commandName,
    author: interaction.user,
    member: interaction.member,
    channel: interaction.channel,
    guild: interaction.guild,
    args: timeOption ? [timeOption, reminderOption].filter(Boolean) : [],
    targetUser,
    textInput,
    numberInput,
    reply: async (payload) => {
      try {
        if (typeof payload === "string") {
          return await interaction.editReply({ content: payload });
        }
        return await interaction.editReply(payload);
      } catch (err) {
        if (typeof payload === "string") {
          return await interaction
            .followUp({ content: payload })
            .catch(() => {});
        }
        return await interaction.followUp(payload).catch(() => {});
      }
    },
    deleteOriginal: null,
  });
});

// Legacy Prefix Handler (!command) + Active Game Guesser
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  // Active game guess checker
  if (activeGames.has(message.channel.id)) {
    const currentGame = activeGames.get(message.channel.id);
    if (lower === "!stopgame") {
      clearTimeout(currentGame.timer);
      activeGames.delete(message.channel.id);
      return message.reply(
        `🛑 Mini-game session halted. The answer was **\`${currentGame.answer}\`**.`,
      );
    }

    if (lower === currentGame.answer.toLowerCase()) {
      clearTimeout(currentGame.timer);
      const currentRound = currentGame.round;
      const gameType = currentGame.type;

      const updatedUser = await DiscordUser.findOneAndUpdate(
        { discordId: message.author.id },
        { $inc: { "gameStats.totalGamesPlayed": 1, botBalance: 50 } },
        { returnDocument: "after" },
      );

      await logActivity({
        author: message.author,
        channel: message.channel,
        guild: message.guild,
        activityType: "GAME_SCRAMBLE_WIN",
        details: {
          gameType,
          answer: currentGame.answer,
          round: currentRound,
          reward: 50,
        },
      });

      await message.reply(
        [
          `🎉 **${message.author}** got it right!`,
          `💰 **+50 Bot EP** credited! New Balance: **${(updatedUser?.botBalance || 0).toLocaleString()} EP** ${EMOJIS.bid}`,
          ``,
          `-# Launching round ${currentRound + 1} in 3 seconds...`,
        ].join("\n"),
      );

      setTimeout(
        () => launchNextRound(message.channel, gameType, currentRound + 1),
        3000,
      );
      return;
    }
  }

  if (!content.startsWith("!")) {
    if (message.mentions.has(client.user.id)) {
      const prompt = content
        .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
        .trim();
      return executeCommand({
        commandName: "ai",
        author: message.author,
        member: message.member,
        channel: message.channel,
        guild: message.guild,
        args: [prompt],
        targetUser: null,
        textInput: prompt,
        numberInput: null,
        reply: (payload) => message.reply(payload),
        deleteOriginal: null,
      });
    }
    return;
  }

  const args = content.slice(1).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();
  const targetUser = message.mentions.users.first() || null;

  await executeCommand({
    commandName,
    author: message.author,
    member: message.member,
    channel: message.channel,
    guild: message.guild,
    args,
    targetUser,
    textInput: args.join(" "),
    numberInput: parseInt(args[0]) || null,
    reply: (payload) => message.reply(payload),
    deleteOriginal: () => message.delete().catch(() => {}),
  });
});

const botToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
client.login(botToken);
