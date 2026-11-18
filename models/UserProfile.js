// models/UserProfile.js
const mongoose = require("mongoose");

const UserProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    username: { type: String, default: "" },

    // Social telemetry: tracks companion affinity
    socialAffinity: [
      {
        targetUserId: { type: String, required: true },
        targetTag: { type: String, default: "" },
        interactionCount: { type: Number, default: 1 },
      },
    ],

    // Commands usage telemetry
    commandTelemetry: {
      type: Map,
      of: Number,
      default: {},
    },

    // Tracking external bot usage (e.g. Plato, OwO, Mudae, Karuta)
    externalBotsUsed: [
      {
        botName: { type: String, required: true },
        botId: { type: String, required: true },
        count: { type: Number, default: 1 },
        lastUsedAt: { type: Date, default: Date.now },
      },
    ],

    // General interests and topics extracted over time
    interests: {
      type: [String],
      default: [],
    },

    // Personality quirks (e.g., "playful banter", "competitive", "brief replies")
    vibeProfile: {
      type: String,
      default: "Neutral server regular",
    },

    totalInteractions: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("UserProfile", UserProfileSchema);
