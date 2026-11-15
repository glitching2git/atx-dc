// models/DiscordUser.js
const mongoose = require("mongoose");

const discordUserSchema = new mongoose.Schema(
  {
    // Discord Snowflake (Unique identifier)
    discordId: { type: String, required: true, unique: true, index: true },

    // Identity & Visuals
    username: { type: String, required: true },
    displayName: { type: String, default: null },
    tag: { type: String, default: null },
    avatarUrl: { type: String, default: null },

    // Roles & Permissions inside Server
    serverRoles: [{ type: String }],
    isStaff: { type: Boolean, default: false },

    // Discord Economy / Points (Bot-specific EP/XP)
    botBalance: { type: Number, default: 0, min: 0, index: true },
    lastDailyClaim: { type: Date, default: null },

    // Mini-Game Stats
    gameStats: {
      scrambleWins: { type: Number, default: 0 },
      diceRolls: { type: Number, default: 0 },
      coinFlips: { type: Number, default: 0 },
      totalGamesPlayed: { type: Number, default: 0 },
    },

    // Engagement & Chat Stats
    chatStats: {
      messageCount: { type: Number, default: 0 },
      aiPromptsCount: { type: Number, default: 0 },
      level: { type: Number, default: 1 },
      xp: { type: Number, default: 0 },
      lastActiveAt: { type: Date, default: Date.now },
    },

    // Moderation History
    moderation: {
      isBanned: { type: Boolean, default: false },
      warnings: [
        {
          reason: String,
          moderatorId: String,
          timestamp: { type: Date, default: Date.now },
        },
      ],
    },

    // Open metadata field for future dynamic data
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    collection: "discord_users", // Kept completely distinct from website 'users'
    timestamps: true,
    strict: false, // Allows inserting any unmapped keys
  },
);

module.exports = mongoose.model("DiscordUser", discordUserSchema);
