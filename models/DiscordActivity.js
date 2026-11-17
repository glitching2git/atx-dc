// models/DiscordActivity.js
const mongoose = require("mongoose");

const discordActivitySchema = new mongoose.Schema(
  {
    // Actor info
    discordId: { type: String, required: true, index: true },
    username: { type: String, required: true },

    // Activity classification
    activityType: {
      type: String,
      required: true,
      index: true,
      enum: [
        "AI_CHAT_PROMPT",
        "MINI_GAME_WIN",
        "GAME_DICE_ROLL",
        "GAME_COIN_FLIP",
        "DAILY_CLAIM",
        "MOD_PURGE",
        "MOD_INVITE_BLOCKED",
        "COMMAND_USE",
        "GENERAL_INTERACTION",
      ],
    },

    // Channel Context
    channelId: { type: String, required: true },
    channelName: { type: String, default: null },
    guildId: { type: String, default: null },
    messageId: { type: String, default: null },

    // Content Details
    details: {
      content: { type: String, default: null },
      aiResponse: { type: String, default: null },
      commandName: { type: String, default: null },
      gameData: { type: mongoose.Schema.Types.Mixed, default: null },
      modData: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    // Open metadata field for arbitrary logging payloads
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    collection: "discord_activities", // Distinct collection
    timestamps: true,
    strict: false, // Allows inserting arbitrary keys
  },
);

// Compound indexes for timeline queries
discordActivitySchema.index({ discordId: 1, createdAt: -1 });
discordActivitySchema.index({ activityType: 1, createdAt: -1 });

module.exports = mongoose.model("DiscordActivity", discordActivitySchema);
