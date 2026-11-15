// deploy-commands.js
require("dotenv").config();
const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const commands = [
  // 1. General & Info
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Open the interactive help directory"),
  new SlashCommandBuilder()
    .setName("rules")
    .setDescription("Display community rules"),
  new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Welcome a member")
    .addUserOption((opt) =>
      opt
        .setName("target")
        .setDescription("Member to welcome")
        .setRequired(false),
    ),

  // 2. Profile & Identity
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View your player profile card")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("User to view").setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your Bot EP balance"),
  new SlashCommandBuilder()
    .setName("birthday")
    .setDescription("Check someone's birthday")
    .addUserOption((opt) =>
      opt
        .setName("target")
        .setDescription("User to inspect")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("setbirthday")
    .setDescription("Save your birthday (DD/MM)")
    .addStringOption((opt) =>
      opt
        .setName("date")
        .setDescription("Date in DD/MM format")
        .setRequired(true),
    ),
  // 3. AI & Smart Utilities
  new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Chat directly with AI")
    .addStringOption((opt) =>
      opt.setName("prompt").setDescription("What to ask").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("eli5")
    .setDescription("Explain a topic simply")
    .addStringOption((opt) =>
      opt
        .setName("topic")
        .setDescription("Concept to explain")
        .setRequired(true),
    ),
  // Change from requiring 'text' to optional 'hours'
  new SlashCommandBuilder()
    .setName("summary")
    .setDescription(
      "Debrief recent server conversations from the past few hours",
    )
    .addIntegerOption((opt) =>
      opt
        .setName("hours")
        .setDescription("Hours to look back (1-12, default: 3)")
        .setMinValue(1)
        .setMaxValue(12)
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("factcheck")
    .setDescription("Fact-check a claim")
    .addStringOption((opt) =>
      opt
        .setName("claim")
        .setDescription("Statement to verify")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("translate")
    .setDescription("Translate text to English & Hindi")
    .addStringOption((opt) =>
      opt.setName("text").setDescription("Text to translate").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("counter")
    .setDescription("Generate a logical counter-argument")
    .addStringOption((opt) =>
      opt
        .setName("statement")
        .setDescription("Statement to counter")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Set a timed reminder")
    .addStringOption((opt) =>
      opt
        .setName("time")
        .setDescription("Time (e.g. 10s, 5m, 2h)")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reminder")
        .setDescription("What to remind you of")
        .setRequired(true),
    ),

  // 4. Social & Fun Meters
  new SlashCommandBuilder()
    .setName("roast")
    .setDescription("Playfully roast a member")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("User to roast").setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("flirt")
    .setDescription("Send a smooth pickup line")
    .addUserOption((opt) =>
      opt
        .setName("target")
        .setDescription("User to flirt with")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("lovemeter")
    .setDescription("Calculate relationship compatibility")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Target member").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("crush")
    .setDescription("Uncover a secret crush rumor")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Target member").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("expose")
    .setDescription("Expose a member's gaming secrets")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Target member").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("simp")
    .setDescription("Calculate simp percentage")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Target member").setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("delulu")
    .setDescription("Measure delusion level")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Target member").setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("aura")
    .setDescription("Calculate aura rating")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Target member").setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("truthdare")
    .setDescription("Get a Truth or Dare challenge"),
  new SlashCommandBuilder()
    .setName("joke")
    .setDescription("Tell a gaming joke"),
  new SlashCommandBuilder()
    .setName("excuse")
    .setDescription("Generate a hilarious gamer excuse")
    .addUserOption((opt) =>
      opt
        .setName("target")
        .setDescription(
          "The user making or needing the excuse (defaults to yourself)",
        )
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("tossacoin")
    .setDescription("Flip a coin (Heads or Tails)"),
  new SlashCommandBuilder()
    .setName("wish")
    .setDescription("Send best wishes")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Member").setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("Custom message")
        .setRequired(false),
    ),

  // 5. Mini-Games
  new SlashCommandBuilder()
    .setName("unscramble")
    .setDescription("Start a continuous word unscramble game"),
  new SlashCommandBuilder()
    .setName("emojigame")
    .setDescription("Start a continuous guess-the-game challenge"),
  new SlashCommandBuilder()
    .setName("fasttype")
    .setDescription("Start a continuous speed-typing contest"),
  new SlashCommandBuilder()
    .setName("quiz")
    .setDescription("Start a continuous trivia quiz game"),
  new SlashCommandBuilder()
    .setName("stopgame")
    .setDescription("Stop the active game session in this channel"),

  // 6. Moderation & Staff
  new SlashCommandBuilder()
    .setName("report")
    .setDescription("Report a user to staff")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("User").setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason").setRequired(true),
    ),
  // new SlashCommandBuilder().setName("cdmod").setDescription("List moderators"),
  // new SlashCommandBuilder()
  //   .setName("cdadm")
  //   .setDescription("List administrators"),
  // new SlashCommandBuilder()
  //   .setName("cdev")
  //   .setDescription("List bot developers"),
  // new SlashCommandBuilder()
  //   .setName("cdown")
  //   .setDescription("List server owners"),
  // new SlashCommandBuilder()
  //   .setName("purge")
  //   .setDescription("Bulk delete messages (Staff only)")
  //   .addIntegerOption((opt) =>
  //     opt
  //       .setName("count")
  //       .setDescription("Number of messages (1-100)")
  //       .setMinValue(1)
  //       .setMaxValue(100)
  //       .setRequired(true),
  //   )
  //   .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_BOT_TOKEN,
);

(async () => {
  try {
    console.log(
      `[DEPLOY] Registering ${commands.length} application commands...`,
    );
    // Routes.applicationCommands registers commands globally across all servers
    const data = await rest.put(
      Routes.applicationCommands(
        process.env.DISCORD_BOT_TOKEN
          ? Buffer.from(
              process.env.DISCORD_BOT_TOKEN.split(".")[0],
              "base64",
            ).toString()
          : process.env.CLIENT_ID,
      ),
      { body: commands },
    );
    console.log(`[DEPLOY] Successfully registered ${data.length} commands.`);
  } catch (error) {
    console.error("[DEPLOY ERROR]:", error);
  }
})();
