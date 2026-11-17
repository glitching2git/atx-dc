// config/emojis.js
let appEmojisCache = [];

const EMOJIS = {
  atx: "<:atx:1369956242159833122>",
  bid: "<a:moneyCoinRich:1571854790420598824>",
  auction: "🏛️",
  timer: "<:aesthetictimer:1572153881704534036>",
  love: "<a:flyingHeartLove:1571805533206216704>",
  alert: "<a:warningAlert:1571926598804971740>",
  trophy: "<a:trophyWinner:1571920809709277235>",
  sparkles: "<a:sparklesstars:1571929733770383521>",
  terminal: "💻",
  shield: "🛡️",
};

async function loadAppEmojis(client) {
  try {
    if (client.application) {
      const fetched = await client.application.emojis.fetch();
      appEmojisCache = Array.from(fetched.values());
      console.log(
        `[EMOJIS] Synchronized ${appEmojisCache.length} Application Emojis from Developer Portal.`,
      );
    }
  } catch (err) {
    console.warn("[EMOJIS] Failed to load application emojis:", err.message);
  }
}

function getAppEmoji(keywords = [], fallback = "") {
  if (!appEmojisCache || appEmojisCache.length === 0) return fallback;
  const kwList = Array.isArray(keywords) ? keywords : [keywords];
  const matched = appEmojisCache.filter((e) =>
    kwList.some((kw) => e.name.toLowerCase().includes(kw.toLowerCase())),
  );

  if (matched.length > 0) {
    const picked = matched[Math.floor(Math.random() * matched.length)];
    return picked.toString();
  }
  return fallback;
}

function injectThemeEmojis(text, theme = "general") {
  if (!text) return "";

  const themeKeywords = {
    roast: [
      "roast",
      "fire",
      "burn",
      "skull",
      "laugh",
      "dead",
      "lol",
      "rip",
      "clown",
    ],
    flirt: [
      "love",
      "heart",
      "kiss",
      "blush",
      "wink",
      "sparkle",
      "rose",
      "cute",
      "eyes",
    ],
    simp: ["simp", "cry", "tear", "plead", "soft", "beg", "heart"],
    delulu: ["delulu", "galaxy", "magic", "unicorn", "star", "clown"],
    aura: [
      "aura",
      "god",
      "crown",
      "glow",
      "lightning",
      "king",
      "chad",
      "queen",
    ],
    secret: ["shh", "secret", "ghost", "lock", "detective", "eyes", "whisper"],
    expose: [
      "siren",
      "alarming",
      "clown",
      "police",
      "warning",
      "caught",
      "expose",
    ],
    wish: ["blessing", "star", "sparkle", "crown", "gem", "angel", "gold"],
    general: ["atx", "cool", "chat", "bot", "game", "sparkle"],
  };

  const keywords = themeKeywords[theme] || themeKeywords.general;
  const matched = (appEmojisCache || []).filter((e) =>
    keywords.some((kw) => e.name.toLowerCase().includes(kw.toLowerCase())),
  );

  if (matched.length === 0) return text.trim();

  const picked = [];
  const shuffled = [...matched].sort(() => 0.5 - Math.random());
  for (const em of shuffled) {
    if (picked.length >= 3) break;
    picked.push(em.toString());
  }

  let clean = text.trim();
  const pauseRegex =
    /(,\s+|\s+—\s+|\s+-\s+|\.\.\.\s+|\s+(?:but|and|or|though|yet)\s+)/i;
  const sentenceEndRegex = /(\.|\!|\?)\s+/;

  const pauseMatch = clean.match(pauseRegex);
  if (pauseMatch && pauseMatch.index && picked.length > 0) {
    const e1 = picked.shift();
    const splitIndex = pauseMatch.index + pauseMatch[0].length;
    clean = `${clean.slice(0, splitIndex).trimEnd()} ${e1} ${clean.slice(splitIndex).trimStart()}`;
  }

  const sentenceMatch = clean.match(sentenceEndRegex);
  if (sentenceMatch && sentenceMatch.index && picked.length > 0) {
    const e2 = picked.shift();
    const splitIndex = sentenceMatch.index + sentenceMatch[0].length;
    clean = `${clean.slice(0, splitIndex).trimEnd()} ${e2} ${clean.slice(splitIndex).trimStart()}`;
  } else if (picked.length > 0) {
    const words = clean.split(/\s+/);
    if (words.length > 6) {
      const e2 = picked.shift();
      const insertIdx = Math.floor(words.length * 0.65);
      words.splice(insertIdx, 0, e2);
      clean = words.join(" ");
    }
  }

  if (picked.length > 0) {
    const lastEmoji = picked.shift();
    clean = `${clean.trimEnd()} ${lastEmoji}`;
  }

  return clean;
}

module.exports = {
  EMOJIS,
  loadAppEmojis,
  getAppEmoji,
  injectThemeEmojis,
};
