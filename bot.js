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

// Services & Models
const {
  connectDB,
  getOrCreateDiscordUser,
  DiscordUser,
  logActivity,
} = require("./services/database");
const User = require("./models/User"); // Path to User model
const UserProfile = require("./models/UserProfile"); // Path to UserProfile model
const { loadAppEmojis, EMOJIS } = require("./config/emojis");
const { registerNitroMimic } = require("./nitro-mimic");
const {
  trackMemberBehavior,
  generateRefinedAiResponse,
} = require("./services/conversationEngine");

// Modular Handlers
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

// Keep-Alive Server
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

// Connect DB
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

  // 0. Handle /connectweb command
  if (ctx.commandName === "connectweb") {
    const code = (ctx.textInput || "").trim();

    if (!code || code.length !== 6) {
      return ctx.reply({
        content:
          "⚠️ **Invalid Code!** Please provide the 6-digit code shown on your ATX Website profile.\nExample: `/connectweb 749201`",
        ephemeral: true,
      });
    }

    try {
      const now = new Date();

      // Find user with valid, unexpired code
      const webUser = await User.findOne({
        connectionCode: code,
        codeExpiresAt: { $gt: now },
      });

      if (!webUser) {
        return ctx.reply({
          content:
            "❌ **Code Expired or Invalid!**\nGenerate a fresh code from your profile page and try again.",
          ephemeral: true,
        });
      }

      // Link accounts in Web DB
      webUser.discordId = ctx.author.id;
      webUser.connectionCode = null;
      webUser.codeExpiresAt = null;
      await webUser.save();

      // Link accounts in Discord UserProfile DB
      const discordProfile = await UserProfile.findOneAndUpdate(
        { userId: ctx.author.id, guildId: ctx.guild.id },
        {
          $set: {
            webUser: webUser._id,
            username: ctx.author.username,
          },
        },
        { upsert: true, returnDocument: "after" },
      );

      const webEp = webUser.xpBalance || 0;
      const botEp = discordProfile.botBalance || 0;
      const combined = webEp + botEp;

      return ctx.reply({
        content: [
          `🔗 **Accounts Successfully Connected!**`,
          `> **Website Callsign:** \`${webUser.username}\``,
          `> **Discord Operator:** ${ctx.author}`,
          ``,
          `📊 **Synchronized EP Ledger:**`,
          `• Website Vault: **${webEp.toLocaleString()} EP**`,
          `• Discord Bot Rewards: **${botEp.toLocaleString()} EP**`,
          `• Total Combined EP: **${combined.toLocaleString()} EP** ⚡`,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[CONNECT WEB ERROR]:", err);
      return ctx.reply({
        content:
          "⚠️ Database error processing account connection. Try again later.",
        ephemeral: true,
      });
    }
  }

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
  console.log(`[DISCORD] ATX Bot is live as ${client.user.tag}`);
  client.user.setActivity("ATX Discord Server ⚔️ 24/7", { type: 3 });

  await loadAppEmojis(client);
  registerNitroMimic(client);
});

// Slash Command Handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
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
    interaction.options.getString("code") ||
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

// Message Handler
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  trackMemberBehavior(message).catch(() => {});

  const content = message.content.trim();
  const lower = content.toLowerCase();

  // Active game guess checker
  if (activeGames.has(message.channel.id)) {
    const currentGame = activeGames.get(message.channel.id);
    if (lower === "!stopgame") {
      clearTimeout(currentGame.timer);
      activeGames.delete(message.channel.id);
      return message.reply(
        `### <:idcDonotCare:1571805403786772500> Mini-game halted\n-# The answer was **\`${currentGame.answer}\`**`,
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

      // Update Discord User EP
      const updatedUser = await DiscordUser.findOneAndUpdate(
        { discordId: message.author.id },
        { $inc: { "gameStats.totalGamesPlayed": 1, botBalance: 50 } },
        { returnDocument: "after" },
      );

      // Keep UserProfile synced as well
      await UserProfile.findOneAndUpdate(
        { userId: message.author.id },
        { $inc: { botBalance: 50 } },
      ).catch(() => {});

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

  // Conversational response check
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

  const botMentioned = message.mentions.has(client.user.id);
  const containsBotName =
    /\b(ai atx|ai starza|starza ai|atx ai|atx|starza)\b/i.test(content);

  if (
    !content.startsWith("!") &&
    (botMentioned || isReplyingToBot || containsBotName)
  ) {
    let cleanPrompt = content
      .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
      .replace(/\b(ai atx|ai starza|starza ai|atx ai|atx|starza)\b/gi, "")
      .trim();

    if (!cleanPrompt) {
      return message.reply(
        "### Need assistance? <:cutie:1571805401194823730>\nAsk anything or explore **/help**!",
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

  // Prefix commands (!command)
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
