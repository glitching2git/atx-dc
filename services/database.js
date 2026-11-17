// services/database.js
const mongoose = require("mongoose");
const { PermissionFlagsBits } = require("discord.js");
const DiscordUser = require("../models/DiscordUser");
const DiscordActivity = require("../models/DiscordActivity");

function connectDB() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  mongoose
    .connect(mongoUri)
    .then(() => console.log("[DATABASE] Connected to DB"))
    .catch((err) => console.error("[DATABASE ERROR]", err));
}

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

module.exports = {
  connectDB,
  getOrCreateDiscordUser,
  logActivity,
  DiscordUser,
  DiscordActivity,
};
