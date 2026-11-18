// modules/identity.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const { DiscordUser, logActivity } = require("../services/database");

function getHelpPages() {
  return [
    new EmbedBuilder()
      .setColor(0x00f3ff)
      .setTitle(
        `<:announcement:1571850123615404162> Welcome to the ATX Discord AI`,
      )
      .setDescription(
        [
          ``,
          `### **• AI Intelligence <a:botAI:1571833293802967081>**`,
          `### **• Continuous Games <a:kuromiLoveChase:1571805445629411429>**`,
          `### **• Social & Fun <a:socialFunFireLaugh:1571834298573529248>**`,
          `### **• Profiles & Privacy <a:fizzarollidance:1571836252255166524>**`,
          ``,
          ``,
          `-# Login to [**Our Website**](https://atx-family.onrender.com/) <a:flameflicker:1571805360145047622>`,
        ].join("\n"),
      )
      .setFooter({ text: "Page 1 of 5 • ATX" }),

    new EmbedBuilder()
      .setColor(0x00d2ff)
      .setTitle(`<a:botAI:1571833293802967081> AI Interaction Commands`)
      .setDescription(
        [
          `### \`/ai <prompt>\` or \`!ai\``,
          `### \`/eli5 <topic>\` or \`!eli5\``,
          `### \`/summary <time>\` or \`!summary\``,
          `### \`/translate <text>\` or \`!translate\``,
          `### \`/counter <statement>\` or \`!counter\``,
          `### \`/factcheck <claim>\` or \`!factcheck\``,
          `### \`/remind <time> <reminder>\` or \`!remind\``,
        ].join("\n"),
      )
      .setFooter({ text: `Page 2 of 5 • AI & Utilities` }),

    new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(`<a:kuromiLoveChase:1571805445629411429> Mini-Games & EP`)
      .setDescription(
        [
          `### \`/quiz\` or \`!quiz\``,
          `### \`/fasttype\` or \`!fasttype\``,
          `### \`/emojigame\` or \`!emojigame\``,
          `### \`/unscramble\` or \`!unscramble\``,
          `### \`/stopgame\` or \`!stopgame\``,
          ``,
          `**<:moneyPaisaPurse:1571805482392227870> Reward:** Each successful answer grants **\` +50 EP \`**`,
        ].join("\n"),
      )
      .setFooter({ text: `Page 3 of 5 • Mini-Games` }),

    new EmbedBuilder()
      .setColor(0xff007f)
      .setTitle(
        `<a:socialFunFireLaugh:1571834298573529248> Social Meters, Banter & Fun`,
      )
      .setDescription(
        [
          `### \`/joke\` or \`!joke\``,
          `### \`/simp [target]\` or \`!simp\``,
          `### \`/wish [target]\` or \`!wish\``,
          `### \`/aura [target]\` or \`!aura\``,
          `### \`/tossacoin\` or \`!tossacoin\``,
          `### \`/truthdare\` or \`!truthdare\``,
          `### \`/crush [target]\` or \`!crush\``,
          `### \`/flirt [target]\` or \`!flirt\``,
          `### \`/roast [target]\` or \`!roast\``,
          `### \`/excuse [target]\` or \`!excuse\``,
          `### \`/delulu [target]\` or \`!delulu\``,
          `### \`/expose [target]\` or \`!expose\``,
          `### \`/lovemeter <target>\` or \`!lovemeter\``,
        ].join("\n"),
      )
      .setFooter({ text: `Page 4 of 5 • Social & Banter` }),

    new EmbedBuilder()
      .setColor(0x7928ca)
      .setTitle(
        `<a:verifiedBadgeApproved:1571805350925967360> Identity, Privacy & Staff Center`,
      )
      .setDescription(
        [
          `### \`/balance\` or \`!balance\``,
          `### \`/profile [target]\` or \`!profile\``,
          `### \`/welcome [target]\` or \`!welcome\``,
          `### \`/birthday [target]\` or \`!birthday\``,
          `### \`/setbirthday <DD/MM>\` or \`!setbirthday\``,
          `### \`/secret <message>\` or \`!secret\``,
          `### \`/report [target] [reason]\` or \`!report @user reason\``,
        ].join("\n"),
      )
      .setFooter({ text: `Page 5 of 5 • Profile` }),
  ];
}

async function handleIdentityCommands({
  commandName,
  author,
  member,
  channel,
  guild,
  args,
  targetUser,
  textInput,
  reply,
  client,
}) {
  if (commandName === "help") {
    let currentPage = 0;
    const pages = getHelpPages();

    const getRow = (idx) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("help_prev")
          .setLabel("◀ Prev")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(idx === 0),
        new ButtonBuilder()
          .setCustomId("help_next")
          .setLabel("Next ▶")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(idx === pages.length - 1),
        new ButtonBuilder()
          .setCustomId("help_close")
          .setLabel("✖ Close")
          .setStyle(ButtonStyle.Danger),
      );

    const helpMsg = await reply({
      embeds: [pages[currentPage]],
      components: [getRow(currentPage)],
      fetchReply: true,
    });

    if (!helpMsg) return true;

    const collector = helpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== author.id) {
        return interaction.reply({
          content: "⚠️ Open your own help menu with `/help`!",
          flags: [MessageFlags.Ephemeral],
        });
      }
      if (interaction.customId === "help_prev")
        currentPage = Math.max(0, currentPage - 1);
      else if (interaction.customId === "help_next")
        currentPage = Math.min(pages.length - 1, currentPage + 1);
      else if (interaction.customId === "help_close")
        return collector.stop("user_closed");

      await interaction.update({
        embeds: [pages[currentPage]],
        components: [getRow(currentPage)],
      });
    });

    collector.on("end", async (_, reason) => {
      if (reason === "user_closed") {
        await helpMsg.delete().catch(() => {});
      } else {
        const disabled = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("1")
            .setLabel("◀ Prev")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("2")
            .setLabel("Next ▶")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        );
        await helpMsg.edit({ components: [disabled] }).catch(() => {});
      }
    });
    return true;
  }

  if (commandName === "profile" || commandName === "balance") {
    const target = targetUser || author;
    const profile = await DiscordUser.findOne({ discordId: target.id });
    if (!profile)
      return reply("No profile initialized yet. Chat in the server first!");

    const safeAuthorName = (target.username || "ATX MEMBER").toUpperCase();
    const userAvatar = target.displayAvatarURL
      ? target.displayAvatarURL()
      : undefined;
    const botAvatar = client.user?.displayAvatarURL
      ? client.user.displayAvatarURL()
      : undefined;

    const msgCount = profile.chatStats?.messageCount || 0;
    const level = Math.floor(Math.sqrt(msgCount / 5)) + 1;
    const progressXP = msgCount % 50;
    const progressBar =
      "█".repeat(Math.floor(progressXP / 5)) +
      "░".repeat(10 - Math.floor(progressXP / 5));

    const embed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: `PROFILE  •  ${safeAuthorName}`,
        iconURL: userAvatar,
      })
      .setThumbnail(userAvatar || null)
      .setDescription(
        [
          ``,
          `> Rank Status: **${profile.isStaff ? "<a:crownBossKingQueen:1571805552303018024> Staff" : "<:memberapprovedids:1571852902295937134> Member"}**`,
          ``,
          `**<a:ranking:1572188246920663041> Level ${level} Progress: ** \` ${progressBar} \` *(${progressXP * 2}%)*`,
          `─────────────────────────────────`,
          `### <a:moneybagcoin:1571920822694715492> **EP Balance:** \` ${(profile.botBalance || 0).toLocaleString()} EP \``,
          `### <a:redenvelopeMessage:1571854787610148954> **Messages Dispatched:** \` ${msgCount.toLocaleString()} \``,
          `### <a:botAI:1571833293802967081> **AI Interactions:** \` ${(profile.chatStats?.aiPromptsCount || 0).toLocaleString()} \``,
          `### <a:kuromiLoveChase:1571805445629411429> **Mini-Games Played:** \` ${(profile.gameStats?.totalGamesPlayed || 0).toLocaleString()} \``,
          `### <:birthdaycake:1571854782170140693> **Birthday Record:** \` ${profile.metadata?.birthday || "Not set"} \``,
          `─────────────────────────────────`,
          `-# <a:tipsfedora:1571856989775073350> Tip: Participate in **Mini Games** to earn +50 EP every round`,
        ].join("\n"),
      )
      .setFooter({
        text: `User ID: ${profile.discordId}`,
        iconURL: botAvatar,
      });

    return reply({ embeds: [embed] });
  }

  if (commandName === "birthday") {
    const target = targetUser || author;
    const doc = await DiscordUser.findOne({ discordId: target.id });
    const bdayRaw = doc?.metadata?.birthday;

    const bdayEmbed = new EmbedBuilder()
      .setColor(bdayRaw ? 0xffa500 : 0x8e8e93)
      .setAuthor({
        name: "🎉 ATX BIRTHDAYS",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        bdayRaw
          ? `## <:birthdaycake:1571854782170140693> ${target}'s Birthday:  \` ${bdayRaw} \``
          : `### <:birthdaycake:1571854782170140693> ${target}'s Birthday: *Not set yet* \n(Use  \` /setbirthday date:DD/MM \`)`,
      )
      .setFooter({ text: `Use /help for more commands` });

    return reply({ embeds: [bdayEmbed] });
  }

  if (commandName === "setbirthday") {
    const dateInput = (textInput || args[0] || "").trim();
    const match = dateInput.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (!match) {
      return reply(
        "### <a:warningAlert:1571926598804971740> Please provide a valid date in `DD/MM` \n-# Format (e.g., `/setbirthday date:15/08` or `!setbirthday 15/08`).",
      );
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
      return reply(
        `### <a:alertWarning:1571926677934575816> \`${dateInput}\` is not a valid calendar date! Please verify the day and month.`,
      );
    }

    const formattedDate = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
    await DiscordUser.findOneAndUpdate(
      { discordId: author.id },
      { $set: { "metadata.birthday": formattedDate } },
      { upsert: true, returnDocument: "after" },
    );

    const embed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: "ATX BIRTHDAY REGISTRY",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        `> <:birthdaycake:1571854782170140693> Your birthday has been recorded as **\` ${formattedDate} \`**`,
      );

    return reply({ embeds: [embed] });
  }

  if (commandName === "rules") {
    const embed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: "ATX SERVER RULES",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `Welcome to the **ATX Family**. To maintain an elite, respectful, and safe community, all members must adhere strictly to these core rules:`,
          ``,
          `### <:numberOne1:1571805438532657193> Mutual Respect & Decency <a:sparklesstarsunsolar:1571929761557647592>`,
          `> Treat every member with dignity. **Zero tolerance** for harassment, toxicity, abuse, slurs, or hate speech across text and voice channels.`,
          ``,
          `### <:numberTwo2:1571805436028653601> Anti-Spam & Chat Hygiene 🚫`,
          `> Keep channels clean and readable. Avoid message flooding, rapid emote spam, wall-of-text copy-pastes, or disruptive mentions.`,
          ``,
          `### <:numberThree3:1571805433532780646> Strictly No NSFW Material <:nsfw:1572178514352939048>`,
          `> Uploading, linking, or discussing adult, explicit, suggestive, or inappropriate content results in an **immediate and permanent ban**.`,
          ``,
          `### <:numberFour4:1571805431503003689> Suspicious Links & Safety <a:warningAlert:1571926598804971740>`,
          `> Do not share unverified downloads, phishing portals, scam links, or malicious files. Automated link monitoring is strictly enforced.`,
          ``,
          `### <:numberFive5:1571805455804670052> Advertising & Self-Promotion <a:announcement2:1571861016306782298>`,
          `> Unauthorized promotion of other Discord servers, group chats, personal products, or commercial ventures is prohibited without admin approval.`,
          ``,
          `### <:numberSix6:1571805524368818276> DM Etiquette & Privacy <:blessings:1571929736203206777>`,
          `> Unsolicited DMs, predatory outreach, or harassing members in private messages will lead to an immediate server blacklist.`,
          ``,
          `-------`,
          `### Need to Report an Incident? <:sirenPolice:1571926589795598346>`,
          `> Use \` /report target:@user reason:<details> \` or [**Report Anonymously**](https://atx-family.onrender.com/contact/) straight to the admins`,
          ``,
          `-# *Failure to comply may trigger warnings, mutes, kicks, or permanent ban.*`,
        ].join("\n"),
      )
      .setFooter({ text: "Server Rules • ATX Family" });

    return reply({ embeds: [embed] });
  }

  if (commandName === "welcome") {
    const target = targetUser || author;
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: "ATX RECEPTION",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `Yooo! **${target.username}** has successfully joined the **ATX Family**`,
          ``,
          `> <a:bookMagic:1571905895296663572> **Mandatory Briefing:** Review server laws with \` /rules \``,
          `> <a:diamondgem:1571920814041858149> **Web Operations:** Login yourself on the [**Official Portal**](https://atx-family.onrender.com/)`,
          `> <a:botAI:1571833293802967081> **Bot Commands:** Use \` /help \` to see all commands`,
          ``,
          `------`,
          `-# <a:redenvelopeMessage:1571854787610148954> **Introduce yourself in chat, squad up for Plato battles, and make yourself at home!**`,
          ``,
        ].join("\n"),
      )
      .setFooter({ text: "ATX Reception • Enter with Honor, Play to Conquer" });

    return reply({
      content: `<:welcome:1571805398615330816> ${target} <:cuteWelcome:1571805395930845235>`,
      embeds: [welcomeEmbed],
    });
  }

  if (commandName === "report") {
    const target = targetUser;
    const reason = textInput || args.slice(1).join(" ");
    if (!target || !reason) {
      return reply(
        "<a:warningAlert:1571926598804971740> Usage: `/report target:@user reason:<reason>`",
      );
    }

    await logActivity({
      author,
      channel,
      guild,
      activityType: "MOD_INVITE_BLOCKED",
      details: { reportedUser: target.id, reason },
    });
    return reply(
      `<a:redandbluesiren:1571926585769201725> **Report** needs some fix, let's talk till then`,
    );
  }

  return false;
}

module.exports = { handleIdentityCommands };
