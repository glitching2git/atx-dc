// nitro-mimic.js
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  ComponentType,
  MessageFlags,
} = require("discord.js");

const webhookCache = new Map(); // channelId -> Webhook

const THEMES = [
  {
    name: "💘 Flirt/Rizz",
    value: "flirt",
    keywords: [
      "love",
      "heart",
      "kiss",
      "blush",
      "wink",
      "sparkle",
      "rose",
      "cute",
      "eyes",
      "couple",
    ],
  },
  {
    name: "🔥 Roast",
    value: "roast",
    keywords: [
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
  },
  {
    name: "🥺 Simp/Soft",
    value: "simp",
    keywords: ["simp", "cry", "tear", "plead", "soft", "beg", "heart"],
  },
  {
    name: "🦄 Delulu/Fantasy",
    value: "delulu",
    keywords: ["delulu", "galaxy", "magic", "unicorn", "star", "clown"],
  },
  {
    name: "⚡ Aura",
    value: "aura",
    keywords: [
      "aura",
      "god",
      "crown",
      "glow",
      "lightning",
      "king",
      "chad",
      "queen",
    ],
  },
  {
    name: "🤫 Secret/Whisper",
    value: "secret",
    keywords: [
      "shh",
      "secret",
      "ghost",
      "lock",
      "detective",
      "eyes",
      "whisper",
    ],
  },
  {
    name: "🚨 Expose/Drama",
    value: "expose",
    keywords: [
      "siren",
      "alarm",
      "clown",
      "police",
      "warning",
      "caught",
      "expose",
    ],
  },
  {
    name: "✨ Blessings/Gold",
    value: "wish",
    keywords: ["blessing", "star", "sparkle", "crown", "gem", "angel", "gold"],
  },
  {
    name: "🎮 Gaming/General",
    value: "general",
    keywords: ["atx", "cool", "chat", "bot", "game", "sparkle"],
  },
];

async function getOrCreateWebhook(channel, client) {
  try {
    if (webhookCache.has(channel.id)) {
      return webhookCache.get(channel.id);
    }

    const me = channel.guild.members.me;
    if (
      !me ||
      !channel.permissionsFor(me).has(PermissionFlagsBits.ManageWebhooks)
    ) {
      return null;
    }

    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(
      (wh) => wh.owner?.id === client.user.id && wh.token,
    );

    if (!webhook) {
      webhook = await channel.createWebhook({
        name: "ATX Nitro",
        avatar: client.user.displayAvatarURL(),
        reason: "Nitro mimic emoji proxy for server members",
      });
    }

    webhookCache.set(channel.id, webhook);
    return webhook;
  } catch (err) {
    console.error(
      `[NITRO MIMIC] Webhook error in #${channel?.name}:`,
      err.message,
    );
    return null;
  }
}

function registerNitroMimic(client) {
  // 1. Autocomplete for Theme Option
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isAutocomplete()) return;
    if (interaction.commandName !== "nitro") return;

    try {
      const focusedOption = interaction.options.getFocused(true);

      if (focusedOption.name === "theme") {
        const query = (focusedOption.value || "").toLowerCase();
        const filtered = THEMES.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            t.value.toLowerCase().includes(query),
        ).slice(0, 25);

        await interaction.respond(
          filtered.map((t) => ({ name: t.name, value: t.value })),
        );
      }
    } catch (err) {
      console.error("[NITRO MIMIC] Autocomplete error:", err.message);
    }
  });

  // 2. Slash Command Execution
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "nitro") return;

    try {
      const statement =
        interaction.options.getString("statement")?.trim() || "";
      const themeKey = interaction.options.getString("theme") || "general";

      const webhook = await getOrCreateWebhook(interaction.channel, client);
      if (!webhook) {
        const noPermMsg = {
          content:
            "⚠️ I need `Manage Webhooks` permission in this channel to send your custom emoji message!",
          flags: [MessageFlags.Ephemeral],
        };
        if (interaction.deferred || interaction.replied) {
          return await interaction.editReply(noPermMsg);
        }
        return await interaction.reply(noPermMsg);
      }

      // Filter application emojis matching selected theme
      const themeConfig = THEMES.find((t) => t.value === themeKey) || THEMES[0];
      const appEmojis = Array.from(
        client.application?.emojis?.cache?.values() || [],
      );

      let matched = appEmojis.filter((e) =>
        themeConfig.keywords.some((kw) => e.name.toLowerCase().includes(kw)),
      );

      if (matched.length === 0) matched = appEmojis;
      const emojiChoices = matched.slice(0, 25);

      if (emojiChoices.length === 0) {
        const noEmojisMsg = {
          content:
            "⚠️ No application emojis are loaded yet! Please wait a moment and try again.",
          flags: [MessageFlags.Ephemeral],
        };
        if (interaction.deferred || interaction.replied) {
          return await interaction.editReply(noEmojisMsg);
        }
        return await interaction.reply(noEmojisMsg);
      }

      // Build the select menu with real emoji icons
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`nitro_pick_${interaction.id}`)
        .setPlaceholder("Select up to 3 emojis to send...")
        .setMinValues(1)
        .setMaxValues(Math.min(3, emojiChoices.length))
        .addOptions(
          emojiChoices.map((e) => ({
            label: e.name.slice(0, 50),
            value: e.toString(),
            emoji: { id: e.id, name: e.name, animated: Boolean(e.animated) },
          })),
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const promptText = statement
        ? `### Pick emojis to accompany your message:\n> *"${statement}"*`
        : `### Pick emojis to send in chat:`;

      const payload = {
        content: promptText,
        components: [row],
        flags: [MessageFlags.Ephemeral],
      };

      // Safe acknowledgment handling (prevents DiscordAPIError[40060])
      let promptMsg;
      if (interaction.deferred || interaction.replied) {
        promptMsg = await interaction.editReply(payload);
      } else {
        promptMsg = await interaction.reply({ ...payload, fetchReply: true });
      }

      const collector = promptMsg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      collector.on("collect", async (selectInteraction) => {
        if (selectInteraction.user.id !== interaction.user.id) return;

        const selectedEmojiTags = selectInteraction.values.join(" ");
        const finalMessage = statement
          ? `${statement} ${selectedEmojiTags}`
          : selectedEmojiTags;

        const member = interaction.member;
        const displayName =
          member?.displayName ||
          interaction.user.globalName ||
          interaction.user.username;
        const avatarURL = interaction.user.displayAvatarURL({ dynamic: true });

        await webhook.send({
          content: finalMessage,
          username: displayName,
          avatarURL: avatarURL,
          allowedMentions: { parse: ["users", "roles"] },
        });

        const successPayload = {
          content: "✅ **Emojis dispatched!**",
          components: [],
        };

        if (selectInteraction.replied || selectInteraction.deferred) {
          await selectInteraction.editReply(successPayload).catch(() => {});
        } else {
          await selectInteraction.update(successPayload).catch(() => {});
        }
        collector.stop("sent");
      });
    } catch (err) {
      console.error("[NITRO MIMIC] Execution error:", err);
    }
  });

  // 3. Prefix fallback (!nitro or !nitro <statement>)
  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith("!nitro")) return;

    try {
      const raw = message.content.slice(6).trim();

      const webhook = await getOrCreateWebhook(message.channel, client);
      if (!webhook) return;

      await message.delete().catch(() => {});

      const appEmojis = Array.from(
        client.application?.emojis?.cache?.values() || [],
      );
      const randomEmoji =
        appEmojis.length > 0
          ? appEmojis[Math.floor(Math.random() * appEmojis.length)].toString()
          : "✨";

      const member = message.member;
      const displayName =
        member?.displayName ||
        message.author.globalName ||
        message.author.username;
      const avatarURL = message.author.displayAvatarURL({ dynamic: true });

      const finalMessage = raw ? `${raw} ${randomEmoji}` : randomEmoji;

      await webhook.send({
        content: finalMessage,
        username: displayName,
        avatarURL: avatarURL,
        files: message.attachments.map((a) => a.url),
        allowedMentions: { parse: ["users", "roles"] },
      });
    } catch (err) {
      console.error("[NITRO MIMIC] Prefix error:", err.message);
    }
  });

  console.log("[MODULE] Nitro Mimic with Interactive Emoji Select ready.");
}

module.exports = { registerNitroMimic };
