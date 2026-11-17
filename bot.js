// bot.js
require("dotenv").config();
const http = require("http");
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  MessageFlags,
} = require("discord.js");

// Services & Config
const {
  connectDB,
  getOrCreateDiscordUser,
  DiscordUser,
  logActivity,
} = require("./services/database");
const { loadAppEmojis, EMOJIS } = require("./config/emojis");
const { registerNitroMimic } = require("./nitro-mimic");
const {
  trackMemberBehavior,
  generateRefinedAiResponse,
} = require("./services/conversationEngine");

// Modular Command Handlers
const {
  activeGames,
  launchNextRound,
  handleGameCommands,
} = require("./modules/games");
const { handleSocialCommands } = require("./modules/social");
const { handleUtilityCommands } = require("./modules/utility");
const { handleIdentityCommands } = require("./modules/identity");

process.on("unhandledRejection", (reason) =>
  console.error("[Process Guard] Unhandled Rejection:", reason),
);
process.on("uncaughtException", (error) =>
  console.error("[Process Guard] Uncaught Exception:", error),
);

// Render Keep-Alive Server
const PORT = process.env.PORT || 3000;
http
  .createServer((_, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "online",
        service: "ATX Discord Bot",
        website: "https://atx-family.onrender.com",
      }),
    );
  })
  .listen(PORT, () =>
    console.log(`[HTTP KEEP-ALIVE] Listening on port ${PORT}`),
  );

// Connect Database
connectDB();

// Initialize Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Central Command Dispatcher
async function executeCommand(ctx) {
  await getOrCreateDiscordUser(ctx.author, ctx.member);

  // 1. Mini-Game Launcher Commands
  const gameHandled = await handleGameCommands(ctx);
  if (gameHandled) return;

  // 2. Social & Banter Commands
  const socialHandled = await handleSocialCommands(ctx);
  if (socialHandled) return;

  // 3. AI & Smart Utilities
  const utilHandled = await handleUtilityCommands(ctx);
  if (utilHandled) return;

  // 4. Profiles, Birthdays, Rules & Moderation
  await handleIdentityCommands(ctx);
}

// Client Lifecycle
client.once(Events.ClientReady, async () => {
  console.log(`[DISCORD] ATX Bot is live and connected as ${client.user.tag}`);
  client.user.setActivity("ATX Discord Server ⚔️ 24/7", { type: 3 });

  await loadAppEmojis(client);
  registerNitroMimic(client);
});

// Slash Command Handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Bypassed immediately so nitro-mimic.js manages deferral without collision
  if (interaction.commandName === "nitro") return;

  const isSecret = interaction.commandName === "secret";
  await interaction
    .deferReply({
      flags: isSecret ? [MessageFlags.Ephemeral] : undefined,
    })
    .catch(() => {});

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
    interaction.options.getString("message") ||
    interaction.options.getString("date") ||
    interaction.options.getString("reason");

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
    client,
    reply: async (payload) => {
      try {
        if (typeof payload === "string")
          return await interaction.editReply({ content: payload });
        return await interaction.editReply(payload);
      } catch (err) {
        if (typeof payload === "string")
          return await interaction
            .followUp({ content: payload })
            .catch(() => {});
        return await interaction.followUp(payload).catch(() => {});
      }
    },
    deleteOriginal: null,
  });
});

// Message Handler (Telemetry, Mini-Games, and Targeted Conversational AI)
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // Track social affinity and command usage in the background
  trackMemberBehavior(message).catch(() => {});

  const content = message.content.trim();
  const lower = content.toLowerCase();

  // Active game guess checker with atomic lock
  if (activeGames.has(message.channel.id)) {
    const currentGame = activeGames.get(message.channel.id);
    if (lower === "!stopgame") {
      clearTimeout(currentGame.timer);
      activeGames.delete(message.channel.id);
      return message.reply(
        `### <:idcDonotCare:1571805403786772500> Mini-game halted.\n-# The answer was **\`${currentGame.answer}\`**.`,
      );
    }

    const cleanGuess = lower
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const cleanTarget = (currentGame.answer || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const isMatch =
      cleanGuess === cleanTarget ||
      cleanGuess === cleanTarget.replace(/^the\s+/, "") ||
      `the ${cleanGuess}` === cleanTarget;

    if (isMatch) {
      if (currentGame.isSolving) return;
      currentGame.isSolving = true;

      clearTimeout(currentGame.timer);
      const currentRound = currentGame.round;
      const gameType = currentGame.type;
      const displayAnswer = currentGame.answer;

      const updatedUser = await DiscordUser.findOneAndUpdate(
        { discordId: message.author.id },
        { $inc: { "gameStats.totalGamesPlayed": 1, botBalance: 50 } },
        { returnDocument: "after" },
      );

      await logActivity({
        author: message.author,
        channel: message.channel,
        guild: message.guild,
        activityType: "MINI_GAME_WIN",
        details: {
          gameType,
          answer: displayAnswer,
          round: currentRound,
          reward: 50,
        },
      });

      await message.reply(
        [
          `<a:sparklesstars:1571929733770383521> **${message.author}** got it right! <a:approvedCorrect:1572188241245900890>`,
          `<a:moneybagcoin:1571920822694715492> **+50 Bot EP** credited! • New Balance: **${(updatedUser?.botBalance || 0).toLocaleString()} EP** ${EMOJIS.bid}`,
          ``,
          `-# <a:lightningAuraBolt:1572172753602224168> Launching round ${currentRound + 1} in 3 seconds...`,
        ].join("\n"),
      );

      setTimeout(() => {
        if (activeGames.has(message.channel.id)) {
          launchNextRound(message.channel, gameType, currentRound + 1, client);
        }
      }, 3000);
      return;
    }
  }

  // 1. Direct reply to one of the bot's messages
  let isReplyingToBot = false;
  if (message.reference && message.reference.messageId) {
    try {
      const referencedMsg = await message.channel.messages.fetch(
        message.reference.messageId,
      );
      if (referencedMsg && referencedMsg.author.id === client.user.id) {
        isReplyingToBot = true;
      }
    } catch (e) {}
  }

  // 2. Direct mention of the bot
  const botMentioned = message.mentions.has(client.user.id);

  // 3. Name check (contains 'atx', 'atx ai', or 'starza')
  const containsBotName = /\b(atx|atx ai|starza)\b/i.test(content);

  // Conversational response check (Strict: No isContinuingChat)
  if (
    !content.startsWith("!") &&
    (botMentioned || isReplyingToBot || containsBotName)
  ) {
    let cleanPrompt = content
      .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
      .replace(/\b(atx|atx ai|starza)\b/gi, "")
      .trim();

    if (!cleanPrompt) {
      return message.reply(
        "### Need assistance? <:cutie:1571805401194823730>\nProvide a prompt or explore `/help`! <:help:1572178506941464717>",
      );
    }

    await message.channel.sendTyping().catch(() => {});

    try {
      const response = await generateRefinedAiResponse(message, cleanPrompt);
      if (response) {
        return message.reply(
          response.length > 2000 ? response.slice(0, 1990) + "..." : response,
        );
      }
    } catch (err) {
      console.error("[CONVERSATION ERROR]:", err.message);
    }
    return;
  }

  // Legacy Prefix Command Handler (!command)
  if (content.startsWith("!")) {
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
      numberInput: parseInt(args[0], 10) || null,
      client,
      reply: (payload) => message.reply(payload),
      deleteOriginal: () => message.delete().catch(() => {}),
    });
  }
});

const botToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
client.login(botToken);
