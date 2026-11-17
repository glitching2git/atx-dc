// modules/games.js
const { EmbedBuilder } = require("discord.js");
const { callAiWithFallback } = require("../services/ai");
const { EMOJIS } = require("../config/emojis");

const activeGames = new Map(); // channelId -> { type, answer, round, timer, isSolving }
const GAME_TIMEOUT_MS = 2 * 60 * 1000;

// Helper to fetch random word by length & difficulty
async function fetchRandomWord(round = 1) {
  let length;
  let diffPool;

  if (round <= 10) {
    length = Math.floor(Math.random() * 2) + 5;
    diffPool = [1, 2, 3];
  } else if (round <= 25) {
    length = Math.floor(Math.random() * 2) + 6;
    diffPool = [2, 3, 4];
  } else {
    length = Math.floor(Math.random() * 2) + 7;
    diffPool = [3, 4, 5];
  }

  const diff = diffPool[Math.floor(Math.random() * diffPool.length)];

  try {
    const res = await fetch(
      `https://random-word-api.herokuapp.com/word?length=${length}&diff=${diff}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (
        Array.isArray(data) &&
        data.length > 0 &&
        typeof data[0] === "string"
      ) {
        const candidate = data[0]
          .toUpperCase()
          .replace(/[^A-Z]/g, "")
          .trim();
        if (candidate.length >= 4) return candidate;
      }
    }
  } catch (err) {
    console.warn("[GAMES] Word API fetch timed out or failed:", err.message);
  }

  return null;
}

async function generateAiGameData(type, round = 1) {
  try {
    if (type === "unscramble") {
      let word = await fetchRandomWord(round);

      // Fallback word pool if the API fails
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

      // Spaced scrambled letters (e.g., "A · T · X · B · O · T")
      const spacedScramble = scrambled.split("").join("·");
      const roundEndTime = Math.floor((Date.now() + GAME_TIMEOUT_MS) / 1000);

      return {
        answer: word,
        embed: new EmbedBuilder()
          .setColor(0x00f3ff)
          .setDescription(
            [
              `### Unscramble the Target word`,
              `## \` ${spacedScramble} \` <a:wordlesolvepuzzle:1572154402326843422>`,
              `─────────────────────────────`,
              `> ${EMOJIS.timer} **Time Limit:** <t:${roundEndTime}:R> (<t:${roundEndTime}:T>)`,
              `> ${EMOJIS.bid} **Round Bounty:** \` +50 EP \``,
              `> <a:diamondgem:1571920814041858149> **Word Length:** \` ${word.length} Letters \``,
              `─────────────────────────────`,
              `-# <a:typing:1572155935915245638> **Type the unscrambled word directly in chat!**`,
            ].join("\n"),
          )
          .setFooter({
            text: `Use /stopgame to end session`,
          }),
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
          .setFooter({ text: `Guess It • Round ${round} • ATX` }),
      };
    }

    if (type === "fasttype") {
      let phrase = null;

      try {
        const res = await fetch("https://dummyjson.com/quotes/random", {
          signal: AbortSignal.timeout(4000),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.quote) {
            quoteAuthor = data.author;

            // Normalize: lowercase, remove punctuation, collapse multiple spaces
            let cleaned = data.quote
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, "")
              .replace(/\s+/g, " ")
              .trim();

            // Scale phrase length based on round
            const words = cleaned.split(" ");
            let targetLength = 6; // Rounds 1-5: ~5-6 words
            if (round > 15)
              targetLength = 12; // Rounds 16+: ~10-12 words
            else if (round > 5) targetLength = 8; // Rounds 6-15: ~7-8 words

            if (words.length > targetLength) {
              cleaned = words.slice(0, targetLength).join(" ");
            }

            if (cleaned.split(" ").length >= 3) {
              phrase = cleaned;
            }
          }
        }
      } catch (err) {
        console.warn("[FASTTYPE API] Fetch failed:", err.message);
      }

      // Offline fallback pool if the API is unreachable
      if (!phrase) {
        const fallbackPhrases = [
          "strike hard before the timer ends",
          "checkmate victory royale in the arena",
          "claim the ep balance and win",
          "super fast fingers win the prize",
          "lag is just an excuse for losing",
          "stay focused and type with speed",
          "never stop until victory is claimed",
        ];
        phrase =
          fallbackPhrases[Math.floor(Math.random() * fallbackPhrases.length)];
      }

      const roundEndTime = Math.floor((Date.now() + GAME_TIMEOUT_MS) / 1000);

      return {
        answer: phrase,
        embed: new EmbedBuilder()
          .setColor(0x00ff88)
          .setDescription(
            [
              `<:announcement:1571850123615404162> First to type this exact phrase wins`,
              ``,
              `\`\`\`ansi`,
              `\u001b[1;32m${phrase}\u001b[0m`,
              `\`\`\``,
              `─────────────────────────────`,
              `> ${EMOJIS.timer} **Time Limit:** <t:${roundEndTime}:R>`,
              `> ${EMOJIS.bid} **Round Bounty:** \` +50 EP \``,
              `─────────────────────────────`,
              `-# <a:typing:1572155935915245638> **Send the exact phrase in chat!**`,
            ].join("\n"),
          )
          .setFooter({ text: `Use /stopgame to end session` }),
      };
    }

    if (type === "quiz") {
      let difficulty = "easy";
      if (round > 15) difficulty = "hard";
      else if (round > 5) difficulty = "medium";

      const decodeHtml = (str) =>
        (str || "")
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&eacute;/g, "é")
          .replace(/&ntilde;/g, "ñ");

      let quizData = null;

      try {
        const res = await fetch(
          `https://opentdb.com/api.php?amount=1&difficulty=${difficulty}&type=multiple`,
          { signal: AbortSignal.timeout(4500) },
        );

        if (res.ok) {
          const data = await res.json();
          if (
            data.response_code === 0 &&
            data.results &&
            data.results.length > 0
          ) {
            const item = data.results[0];
            const cleanQuestion = decodeHtml(item.question);
            const cleanCorrect = decodeHtml(item.correct_answer).trim();

            quizData = {
              question: cleanQuestion,
              answer: cleanCorrect,
              category: decodeHtml(item.category),
              difficulty: difficulty.toUpperCase(),
            };
          }
        }
      } catch (err) {
        console.warn("[QUIZ API] OpenTDB fetch error:", err.message);
      }

      // Fallback in case of API rate limits
      if (!quizData) {
        quizData = {
          question:
            "Which planet is known as the Red Planet in our solar system?",
          answer: "Mars",
          category: "Science: Astronomy",
          difficulty: "EASY",
        };
      }

      const roundEndTime = Math.floor((Date.now() + GAME_TIMEOUT_MS) / 1000);
      const firstLetter = quizData.answer.charAt(0);
      const letterCount = quizData.answer.replace(/\s+/g, "").length;

      return {
        answer: quizData.answer,
        embed: new EmbedBuilder()
          .setColor(
            difficulty === "hard"
              ? 0xff0055
              : difficulty === "medium"
                ? 0xffa500
                : 0x00f3ff,
          )
          .setDescription(
            [
              `**Category <a:glowingsparkle:1571929751105315017> ${quizData.category}**`,
              ``,
              `### <a:questionmark:1572172749525221396> ${quizData.question}`,
              ``,
              `─────────────────────────────`,
              `> ${EMOJIS.timer} **Time Limit:** <t:${roundEndTime}:R>`,
              `> ${EMOJIS.bid} **Round Bounty:** +50 EP`,
              `> <a:tipsfedora:1571856989775073350> **Hint:** ${letterCount} Letters • **Starts with: \` ${firstLetter} \`**`,
              `─────────────────────────────`,
              `-# <a:typing:1572155935915245638> **Type the exact answer directly in chat!**`,
            ].join("\n"),
          )
          .setFooter({ text: `Use /stopgame to end session` }),
      };
    }
  } catch (err) {
    return {
      answer: "ACCELERATE",
      embed: new EmbedBuilder()
        .setColor(0x00f3ff)
        .setTitle("🎮 ATX Game Backup")
        .setDescription(
          "Unscramble this word: **`LATEACARCE`**\nTime: 2 Minutes!",
        ),
    };
  }
}

async function launchNextRound(channel, type, round = 1, client) {
  if (activeGames.has(channel.id)) {
    clearTimeout(activeGames.get(channel.id).timer);
  }

  const gameData = await generateAiGameData(type, round);
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
        .setDescription(
          [
            `### <:gameOverFinishEnd:1571805470249975878> Nobody was able to solve it`,
            ``,
            `> <a:approvedCorrect:1572188241245900890> **Correct Answer:** ${currentGame.answer}`,
            `> <:deadSkull:1571908653966041308> **Survived:** ${currentGame.round} Round${currentGame.round === 1 ? "" : "s"}`,
            ``,
            `-# Start new round with \`/${type}\` or \`!${type}\` `,
          ].join("\n"),
        )
        .setFooter({ text: "Use /help • Better luck next time!" });
      await channel.send({ embeds: [timeoutEmbed] }).catch(() => {});
    }
  }, GAME_TIMEOUT_MS);

  activeGames.set(channel.id, {
    type,
    answer: gameData.answer,
    round,
    timer,
    isSolving: false,
  });

  gameData.embed.setAuthor({
    name: `${commandTitle} • ROUND - ${round}`,
    iconURL: client.user?.displayAvatarURL(),
  });

  await channel.send({ embeds: [gameData.embed] });
}

async function handleGameCommands({ commandName, channel, reply, client }) {
  if (["unscramble", "emojigame", "fasttype", "quiz"].includes(commandName)) {
    if (activeGames.has(channel.id)) {
      return reply(
        "### <:gonnaCrySob:1571805498309611640> Oiii... An arena game is already ongoing!\nUse `!stopgame` or `/stopgame` to cancel.",
      );
    }
    await reply(`Starting **${commandName}**! Initializing round 1...`);
    await launchNextRound(channel, commandName, 1, client);
    return true;
  }

  if (commandName === "stopgame") {
    if (!activeGames.has(channel.id)) {
      return reply(
        "### <:donotbullyids:1571852913708498955> No game is currently active in this channel!",
      );
    }
    const cur = activeGames.get(channel.id);
    clearTimeout(cur.timer);
    activeGames.delete(channel.id);
    return reply(
      `### <:idcDonotCare:1571805403786772500> Mini-game halted.\n-# The answer was **\`${cur.answer}\`**.`,
    );
  }

  return false;
}

module.exports = {
  activeGames,
  launchNextRound,
  handleGameCommands,
};
