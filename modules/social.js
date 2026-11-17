// modules/social.js
const { EmbedBuilder } = require("discord.js");
const { callAiWithFallback } = require("../services/ai");
const { getAppEmoji, injectThemeEmojis } = require("../config/emojis");

async function handleSocialCommands({
  commandName,
  author,
  channel,
  guild,
  args,
  targetUser,
  textInput,
  reply,
  client,
}) {
  if (commandName === "roast" || commandName === "flirt") {
    const target = targetUser || author;
    const isSelf = target.id === author.id;
    const targetName = target.username;

    let aiPrompt = "";
    let systemPersona = "";

    if (commandName === "roast") {
      aiPrompt = isSelf
        ? `Roast ${author.username} who asked to be roasted themselves. Mock their self-pity and lack of attention.`
        : `Deliver an elite, ruthless, and hilarious roast directed personally at ${targetName}. Reference their real life struggles, being single forever, gaming skill issues, embarrassing choke moments, excessive confidence with zero trophies, or absolute bot-like existence in Discord and Plato.`;

      systemPersona = [
        "You are an elite, savage roast comic inspired by the sharp sarcasm of Samay Raina and the raw punch of CarryMinati.",
        "RULES:",
        "- Output strictly ONE or TWO punchy sentences maximum.",
        "- Address the victim directly ('You...').",
        "- Make it witty, sharp, unexpected, and devastatingly funny without using slurs or hateful content.",
        "- No preamble, no quotes, no 'Here is your roast:'. Jump straight into the punchline.",
      ].join("\n");
    } else {
      aiPrompt = isSelf
        ? `Deliver an ego-boosting, ultra-charming, smooth flirt line to ${author.username}.`
        : `Deliver a high-level, irresistibly smooth, witty, and charming flirt line directed to ${targetName}.`;

      systemPersona = [
        "You are an OG master of rizz and romance — smooth, magnetic, poetic, and effortlessly witty.",
        "RULES:",
        "- Output strictly ONE smooth, charming line (1-2 sentences maximum).",
        "- Speak directly with bold confidence, razor-sharp wit, and magnetic presence.",
        "- No quotation marks, no preamble, no robotic chatter.",
      ].join("\n");
    }

    const line = await callAiWithFallback(aiPrompt, systemPersona);
    const cleaned =
      line?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
      (commandName === "roast"
        ? `${targetName}, even the AI refused to roast you because your gameplay already does the job.`
        : `${targetName}, you're the kind of distraction that makes losing an entire win streak feel worth it.`);

    const isRoast = commandName === "roast";
    const mixedLine = injectThemeEmojis(cleaned, isRoast ? "roast" : "flirt");

    const embed = new EmbedBuilder()
      .setColor(isRoast ? 0xff3b30 : 0xff2d55)
      .setAuthor({
        name: isRoast ? "ATX SAVAGE ROAST 🔥" : "ATX HIGH-TIER RIZZ 💘",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `### ${isRoast ? "<a:peperoastedpepe:1571870778633224433><a:peperoastedpepe:1571870778633224433><a:peperoastedpepe:1571870778633224433><a:peperoastedpepe:1571870778633224433><a:peperoastedpepe:1571870778633224433><a:peperoastedpepe:1571870778633224433>" : "<a:emolgawinkCharmLove:1571871530932117564> <a:emolgawinkCharmLove:1571871530932117564> <a:emolgawinkCharmLove:1571871530932117564> <a:emolgawinkCharmLove:1571871530932117564> <a:emolgawinkCharmLove:1571871530932117564> <a:emolgawinkCharmLove:1571871530932117564>"}`,
          ``,
          `> **${mixedLine}**`,
          ``,
        ].join("\n"),
      )
      .setFooter({
        text: isRoast
          ? "React funny at it • No Hard Feelings"
          : "Smoooooth like butter • React or Die",
      });

    return reply({ content: `${target}`, embeds: [embed] });
  }

  if (commandName === "lovemeter") {
    const target = targetUser;
    if (!target) {
      return reply(
        "## <:shutupSilentZipped:1571805467670347796> <:vdayheartsingle4ever:1571887866806673469> Mention someone to test your compatibility!\n-# <:31967goodideaids:1571852911535857724> Use ` /lovemeter target:@user `",
      );
    }

    if (target.id === author.id) {
      return reply(
        "### <:mostHated:1571805386904698980> <:cutie:1571805401194823730> Self-love is important, but pick another member to test real chemistry! <:cutenote_YoullBeOk:1571805377761255505>",
      );
    }

    const daySeed = new Date().toISOString().slice(0, 10);
    const combinedIds = [author.id, target.id].sort().join("") + daySeed;
    let hash = 0;
    for (let i = 0; i < combinedIds.length; i++) {
      hash = (hash << 5) - hash + combinedIds.charCodeAt(i);
      hash |= 0;
    }
    const percent = Math.abs(hash) % 101;

    const loveHeart = "<:redheartwithavelvetbow:1571894452375650314>";
    const emptyHeart = "<:heartempty:1571892707389866064>";
    const filledHearts = Math.round(percent / 10);
    const emptyHearts = 10 - filledHearts;
    const progressBar =
      loveHeart.repeat(filledHearts) + emptyHeart.repeat(emptyHearts);

    let color = 0xff2d55;
    let statusTitle = "";
    let fallbackVerdict = "";

    if (percent >= 90) {
      statusTitle =
        "<a:diamondRingEngaged:1571805539636355204> Soulmates Destined By Fate";
      fallbackVerdict =
        "Absolute peak compatibility! Start planning the wedding and locking in duo queues.";
      color = 0xff007f;
    } else if (percent >= 70) {
      statusTitle = "🔥 Passionate High-Voltage Chemistry";
      fallbackVerdict =
        "Solid dynamic with unmatched mutual vibes. A power couple in the making.";
      color = 0xff2d55;
    } else if (percent >= 45) {
      statusTitle = "✨ Playful Banter & Friendship";
      fallbackVerdict =
        "Strong foundation with occasional chaotic friction. Worth exploring!";
      color = 0xff9500;
    } else if (percent >= 20) {
      statusTitle = "🧊 Dangerous Cold Front";
      fallbackVerdict =
        "Friction detected. Stick to friendly discord arguments and maintain distance.";
      color = 0x5856d6;
    } else {
      statusTitle = "☠️ Catastrophic System Failure";
      fallbackVerdict =
        "Zero romantic telemetry. Even the Plato algorithm refuses to match this duo.";
      color = 0x8e8e93;
    }

    const aiRes = await callAiWithFallback(
      `Generate a witty, dramatic, and entertaining 1-2 sentence compatibility verdict for two Discord members: ${author.username} and ${target.username}.
Their calculated compatibility is ${percent}% (${statusTitle}).
Rules:
- Address both of them or their dynamic directly.
- Tailor the tone strictly to their score.
- Output ONLY the raw verdict text without quotation marks.`,
      "You are the ATX Love Oracle. Deliver only the witty compatibility verdict.",
    );

    const verdict =
      aiRes?.replace(/^["'\s]+|["'\s]+$/g, "").trim() || fallbackVerdict;
    const mixedVerdict = injectThemeEmojis(verdict, "flirt");
    const prominentLove = getAppEmoji(
      ["heart", "love"],
      "<a:sparklyheartCute:1571805531058733107>",
    );

    const loveEmbed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: "ATX CUPID RADAR",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `### ${prominentLove} **${author.username}** ${prominentLove} **${target.username}** ${prominentLove}`,
          ``,
          `### Compatibility: \` ${percent}% \``,
          `## ${progressBar}`,
          ``,
          `### <:fortuneteller:1571897563781664929> Oracle Verdict`,
          `> **${mixedVerdict}**`,
          ``,
        ].join("\n"),
      )
      .setFooter({ text: "Love Meter • Scores refresh every 24 hours" });

    return reply({
      content: `${author} <a:revolvingheartslove:1571892692114341888> ${target}`,
      embeds: [loveEmbed],
    });
  }

  if (["simp", "delulu", "aura"].includes(commandName)) {
    const target = targetUser || author;
    const daySeed = new Date().toISOString().slice(0, 10);
    const seedString = `${target.id}_${commandName}_${daySeed}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      hash = (hash << 5) - hash + seedString.charCodeAt(i);
      hash |= 0;
    }
    const positiveHash = Math.abs(hash);
    let embed = new EmbedBuilder();

    if (commandName === "simp") {
      const score = positiveHash % 101;
      const filled = Math.round(score / 10);
      const simpIcon = "<:excitedSimp:1571902783785803796>";
      const emptyIcon = "<:emptySadLow:1571902778165563433>";
      const bar = simpIcon.repeat(filled) + emptyIcon.repeat(10 - filled);

      let statusTitle = "";
      let color = 0xff758f;
      let defaultPunchline = "";

      if (score >= 80) {
        statusTitle = "👑 Down Horrendous / Master Simp";
        color = 0xff0055;
        defaultPunchline =
          "Would literally apologize if someone else stepped on their foot.";
      } else if (score >= 50) {
        statusTitle = "💌 Chronic Softie / High Simp";
        color = 0xff758f;
        defaultPunchline =
          "Replies to DMs in 0.2 seconds and overuses heart emojis.";
      } else if (score >= 25) {
        statusTitle = "🛡️ Balanced Casual";
        color = 0xffb3c1;
        defaultPunchline =
          "Cares just enough to keep it friendly, but won't lose sleep over anyone.";
      } else {
        statusTitle = "🗿 Cold Stone / Zero Simp";
        color = 0x6c757d;
        defaultPunchline =
          "Heart made of pure tungsten. Leaves everyone on read without flinching.";
      }

      const aiLine = await callAiWithFallback(
        `Generate ONE savage or funny punchline (strictly 1 sentence) roasting or reviewing ${target.username}'s Simp meter score of ${score}% (${statusTitle}).
Rules: Speak directly about them. Sarcastic, funny, no quotes, no intros.`,
        "You are a witty Discord comic.",
      );
      const punchline =
        aiLine?.replace(/^["'\s]+|["'\s]+$/g, "").trim() || defaultPunchline;
      const mixedPunchline = injectThemeEmojis(punchline, "simp");

      embed
        .setColor(color)
        .setAuthor({
          name: "ATX SIMP EVALUATION",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          [
            `## ||${statusTitle}||`,
            `### <a:reverserolllove:1571900422753619989> Simp Rating: \` ${score}% \``,
            `## ${bar}`,
            ``,
            `### <a:searchingbunfood:1571900427346382858> Behavioral Diagnosis`,
            `> **${mixedPunchline}**`,
            ``,
          ].join("\n"),
        )
        .setFooter({ text: "Diagnostic metrics refresh daily at midnight" });

      return reply({ content: `${target}`, embeds: [embed] });
    }

    if (commandName === "delulu") {
      const score = positiveHash % 101;
      const solulu = 100 - score;
      const filled = Math.round(score / 10);
      const deluluIcon = "<a:halloweenpumpkinandbatDelulu:1571905899671457893>";
      const brainIcon = "<a:bookMagic:1571905895296663572>";
      const bar = deluluIcon.repeat(filled) + brainIcon.repeat(10 - filled);

      let statusTitle = "";
      let color = 0xa855f7;
      let defaultPunchline = "";

      if (score >= 80) {
        statusTitle = "🌌 Living In A Parallel Universe";
        color = 0x9333ea;
        defaultPunchline =
          "Believes eye contact for 0.5 seconds means marriage is imminent.";
      } else if (score >= 50) {
        statusTitle = "🦄 Hopeful Dreamer / Certified Delulu";
        color = 0xc084fc;
        defaultPunchline =
          "Blames Mercury retrograde for missed skill shots in Plato.";
      } else if (score >= 25) {
        statusTitle = "⚖️ Grounded With Occasional Daydreams";
        color = 0x38bdf8;
        defaultPunchline =
          "Knows reality is harsh, but keeps a small delusion alive for fun.";
      } else {
        statusTitle = "📐 Hardcore Realist / Maximum Solulu";
        color = 0x22c55e;
        defaultPunchline =
          "Zero imagination. Calculates tax brackets while playing games.";
      }

      const aiLine = await callAiWithFallback(
        `Generate ONE witty, funny 1-sentence commentary on ${target.username}'s Delusion score of ${score}% (Solulu: ${solulu}%).
Tone: Internet culture humor. No quotes, no intro.`,
        "You are a witty internet culture observer.",
      );
      const punchline =
        aiLine?.replace(/^["'\s]+|["'\s]+$/g, "").trim() || defaultPunchline;
      const mixedPunchline = injectThemeEmojis(punchline, "delulu");

      embed
        .setColor(color)
        .setAuthor({
          name: "ATX DELULU LABS",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          [
            `## ||${statusTitle}||`,
            `### <:delulu:1571905882239934474> Delulu Level: \` ${score}% \``,
            `## ${bar}`,
            `> Solulu Level (Realism): **\` ${solulu}% \`**`,
            ``,
            `### <a:magicbook:1571905888640442398> Reality Distortion`,
            `> **${mixedPunchline}**`,
            ``,
          ].join("\n"),
        )
        .setFooter({ text: "Delulu index recalibrates every 24 hours" });

      return reply({ content: `${target}`, embeds: [embed] });
    }

    if (commandName === "aura") {
      const isPositive = positiveHash % 2 === 0;
      const rawPoints = (positiveHash * 13) % 100001;
      const auraPoints = isPositive ? rawPoints : -rawPoints;

      let statusTitle = "";
      let color = 0x00f3ff;
      let bar = "";
      let defaultPunchline = "";

      const sparkle = "<:crownKingBoss:1571805491124764733>";
      const skull = getAppEmoji(["skull"], "<:deadSkull:1571908653966041308>");

      if (auraPoints >= 50000) {
        statusTitle = "👑 Transcendent Divine Aura (+MAX)";
        color = 0xffd700;
        bar = sparkle.repeat(10);
        defaultPunchline =
          "Enters the voice channel and everyone instinctively sits up straight.";
      } else if (auraPoints > 0) {
        statusTitle = "⚡ High Roller / Main Character Aura";
        color = 0x00f3ff;
        bar = "<a:electricityBoltLightening:1571908670571413544>".repeat(10);
        defaultPunchline = "Walks away from explosions without looking back.";
      } else if (auraPoints > -50000) {
        statusTitle = "📉 Stumbling / Minor Aura Deficit";
        color = 0xf97316;
        bar = skull.repeat(5) + "⬛".repeat(5);
        defaultPunchline =
          "Waved back at someone who was actually waving at the person behind them.";
      } else {
        statusTitle = "🕳️ Black Hole Debt / Negative Infinite Aura";
        color = 0xef4444;
        bar = skull.repeat(10);
        defaultPunchline =
          "Tripped on a flat surface and apologized to the pavement.";
      }

      const formattedAura =
        auraPoints > 0
          ? `+${auraPoints.toLocaleString()}`
          : `${auraPoints.toLocaleString()}`;

      const aiLine = await callAiWithFallback(
        `Generate ONE short, funny 1-sentence comment explaining why ${target.username} has an Aura rating of ${formattedAura} (${statusTitle}).
Tone: Modern gamer and internet slang. No quotes, no intro.`,
        "You are an expert on meme culture and Aura scores.",
      );
      const punchline =
        aiLine?.replace(/^["'\s]+|["'\s]+$/g, "").trim() || defaultPunchline;
      const mixedPunchline = injectThemeEmojis(punchline, "aura");
      const headerEmoji = "<a:crownBossKingQueen:1571805552303018024>";

      embed
        .setColor(color)
        .setAuthor({
          name: "ATX AURA SCANNER",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          [
            `### ||${statusTitle}||`,
            `### <a:electricityBoltLightening:1571908670571413544> \` ${formattedAura} \` Aura Points ${headerEmoji}`,
            `## ${bar}`,
            ``,
            `### <:announcement:1571850123615404162> Aura Incident Report`,
            `> **${mixedPunchline}**`,
            ``,
          ].join("\n"),
        )
        .setFooter({
          text: "Aura balances fluctuate daily based on spiritual presence",
        });

      return reply({ content: `${target}`, embeds: [embed] });
    }
  }

  if (commandName === "crush" || commandName === "expose") {
    const target = targetUser || author;
    const daySeed = new Date().toISOString().slice(0, 10);
    const seed = `${target.id}_${commandName}_${daySeed}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const randIndex = Math.abs(hash);
    let embed = new EmbedBuilder();

    if (commandName === "crush") {
      const domains = [
        "Current Gen-Z viral meme personality or internet icon",
        "Popular Indian Stand-up Comedian (e.g., Zakir Khan, Samay Raina, Bassi, Harsh Gujral, etc.)",
        "International Pop Icon or Singer (e.g., Dua Lipa, Sabrina Carpenter, Billie Eilish, The Weeknd, Diljit)",
        "Top Indian or International Cricketer / Footballer / Athlete (e.g., Rohit Sharma, Smriti Mandhana, Hardik Pandya, Haaland, Leclerc)",
        "Gaming youtuber",
        "Footballer",
        "Bollywood or South Indian Cinema Star (e.g., Triptii Dimri, Rashmika, Kartik Aaryan, Vijay Deverakonda, Mrunal Thakur)",
        "Hollywood Actor or Actress (e.g., Pedro Pascal, Cillian Murphy, Sydney Sweeney, Florence Pugh, Timothée Chalamet)",
        "Famous Esports",
        "Stand-up Comedian",
        "Cricketer",
        "Famous Esports / Gaming Streamer or YouTuber (e.g., Speed, Kai Cenat, Mortal, Scout)",
      ];

      const selectedDomain =
        domains[Math.floor(Math.random() * domains.length)];
      const randomSeed = Math.floor(Math.random() * 100000);

      let chosenCrush = "Diljit Dosanjh";
      let chosenPunchline = "";

      const aiResponse = await callAiWithFallback(
        `Session Nonce: #${randomSeed}
Task:
1. Pick ONE distinct, recognizable person strictly from this category: "${selectedDomain}".
CRITICAL: Do NOT pick Zendaya, Virat Kohli, or Shubman Gill. Pick someone fresh, unexpected, and iconic.
2. Write a hilarious, spicy, and flirtatious gossip punchline revealing that ${target.username} has a massive, desperate secret crush on them.

Rules:
- Length: Strictly 1 or 2 punchy sentences.
- Tone: Teasing, witty, and dramatic like an authentic group chat leak.
- Output Format: Return ONLY raw, valid JSON without markdown wrapping or preamble:
{"crush": "Exact Name", "punchline": "Punchline text here"}`,
        "You are the server's sharpest gossip comic. Output strictly valid JSON.",
      );

      if (aiResponse) {
        try {
          const cleaned = aiResponse.replace(/```json|```/gi, "").trim();
          const parsed = JSON.parse(cleaned);
          if (parsed.crush && parsed.punchline) {
            chosenCrush = parsed.crush.trim();
            chosenPunchline = parsed.punchline.trim();
          }
        } catch (e) {}
      }

      if (!chosenPunchline) {
        const fallbackPool = [
          "Diljit Dosanjh",
          "Samay Raina",
          "Triptii Dimri",
          "Pedro Pascal",
          "Smriti Mandhana",
          "Charles Leclerc",
          "Sabrina Carpenter",
          "Hardik Pandya",
          "Mrunal Thakur",
          "Cillian Murphy",
          "Zakir Khan",
          "Sydney Sweeney",
          "Speed",
          "Rashmika Mandanna",
          "The Weeknd",
          "Anya Taylor-Joy",
          "Rohit Sharma",
          "Florence Pugh",
          "Kartik Aaryan",
          "Dua Lipa",
        ];
        chosenCrush =
          fallbackPool[Math.floor(Math.random() * fallbackPool.length)];

        const fallbackCrushLines = [
          `Caught rehearsing wedding vows in the mirror every night before checking their updates.`,
          `Was seen refreshing ${chosenCrush}'s feed every 4 minutes hoping for a miracle DM.`,
          `Secretly bookmarked all their clips and insists they are just 'studying camera angles'.`,
          `Claims they only follow ${chosenCrush} for the 'interview intellect' while sweating profusely.`,
        ];
        chosenPunchline =
          fallbackCrushLines[
            Math.floor(Math.random() * fallbackCrushLines.length)
          ];
      }

      const mixedPunchline = injectThemeEmojis(chosenPunchline, "flirt");
      const headerEmoji = getAppEmoji(["heart", "flirt", "love"], "💌");

      embed
        .setColor(0xff007f)
        .setAuthor({
          name: "GOSSIP LEAK • SECRET CRUSH",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          [
            `### ${headerEmoji} Secret Crush: **|| ${chosenCrush} ||**`,
            ``,
            `> **${mixedPunchline}**`,
            ``,
            `### <a:RatingMeterLevel:1571918521116524564> **Obsession Level:** \` ${(randIndex % 65) + 35}% \``,
            `### <a:megaphoneSourceAnnouncement:1571920802775961660> **Source:** \` Unfiltered Gossips \``,
            ``,
            `-# **Gossip telemetry recalculates daily at midnight**`,
          ].join("\n"),
        )
        .setFooter({ text: "ATX Cupid Watch • No Love with Love" });

      return reply({ content: `${target}`, embeds: [embed] });
    }

    if (commandName === "expose") {
      const now = new Date();
      const hourSeed = `${now.toISOString().slice(0, 10)}-${String(now.getUTCHours()).padStart(2, "0")}`;
      const seedExp = `${target.id}_expose_${hourSeed}`;
      let hashExp = 0;
      for (let i = 0; i < seedExp.length; i++) {
        hashExp = (hashExp << 5) - hashExp + seedExp.charCodeAt(i);
        hashExp |= 0;
      }
      const hourIndex = Math.abs(hashExp);

      const historicalBlunders = [
        "Loris Karius gifting Real Madrid goals in the 2018 Champions League final",
        "Ferrari's F1 pit-stop strategy clown shows",
        "Steve Harvey announcing the wrong Miss Universe winner on live global TV",
        "South Africa finding brand new mathematical ways to choke in ICC World Cup knockouts",
        "The Titanic lookouts declaring the ship unsinkable while ignoring ice warnings",
        "FC Barcelona blowing a 3-0 lead against Liverpool at Anfield",
        "Will Smith crashing the stage at the Oscars",
        "The meme guy checking out another girl while holding his girlfriend's hand",
        "The infamous CrowdStrike blue-screen outage crashing global systems",
        "Manchester United conceding 7-0 to Liverpool",
        "NASA losing a $125 million Mars climate orbiter due to a metric-to-imperial conversion error",
        "Lance Stroll suddenly turning into a wall and asking who hit him",
      ];
      const selectedBlunder =
        historicalBlunders[hourIndex % historicalBlunders.length];

      const aiLine = await callAiWithFallback(
        `Deliver an elite, comedic roast comparing gamer ${target.username}'s skills/life/decision-making to this real-world disaster/fail: "${selectedBlunder}".
Rules:
- Length: Strictly 1 to 2 sentences.
- Tone: Savage stand-up comedian style (like Samay Raina or CarryMinati).
- No quotes, no intro. Jump straight into the punchline.`,
        "You are an elite roast comedian.",
      );
      const fallbackFails = [
        `Their decision-making makes Ferrari's F1 strategy team look like Nobel Prize winners.`,
        `Watching them play under pressure is like watching Loris Karius in a Champions League final—pure tragedy with zero defense.`,
        `They choke leads faster than South Africa in an ICC knockout match.`,
        `Their situational awareness is on par with the Titanic crew casually ignoring ice warnings.`,
      ];
      const punchline =
        aiLine?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
        fallbackFails[hourIndex % fallbackFails.length];
      const mixedPunchline = injectThemeEmojis(punchline, "expose");
      const headerEmoji = getAppEmoji(["siren"], "🚨");

      embed
        .setColor(0xff3300)
        .setAuthor({
          name: "ATX DECLASSIFIED EXPOSED",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          [
            `### ${headerEmoji} Exposing: **${target.username}**`,
            ``,
            `### <a:announcmentAlert:1571926579708170270> Declassified Verdict`,
            `> **${mixedPunchline}**`,
            ``,
          ].join("\n"),
        )
        .setFooter({ text: "Hall of Shame • Emotional Damage Guaranteed" });

      return reply({ content: `${target}`, embeds: [embed] });
    }
  }

  if (commandName === "wish") {
    const target = targetUser || author;
    const customWishText =
      textInput && !textInput.startsWith("<@")
        ? textInput
        : args.length > (targetUser ? 1 : 0)
          ? args
              .slice(targetUser ? 1 : 0)
              .join(" ")
              .trim()
          : "";

    const now = new Date();
    const hourSeed = `${now.toISOString().slice(0, 10)}-${String(now.getUTCHours()).padStart(2, "0")}`;
    const seed = `${target.id}_wish_${hourSeed}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const hourIndex = Math.abs(hash);

    const wishThemes = [
      "unshakable win streaks, god-tier RNG, and flawless competitive clutch moments",
      "wealth, abundance of EP tokens, and triumphing in weekly high-roller auctions",
      "peak personal energy, conquering real-life battles, and ultimate good fortune",
      "invincible mental resilience, flawless ping, and zero server lag across every arena",
      "legendary aura, boundless happiness, and eternal respect within the ATX brotherhood",
    ];
    const selectedTheme = wishThemes[hourIndex % wishThemes.length];

    let finalWish = "";
    if (customWishText) {
      finalWish = customWishText;
    } else {
      const aiWish = await callAiWithFallback(
        `Craft an inspiring, legendary, and heartening gamer blessing/wish for ${target.username}.
Theme: ${selectedTheme}.
Rules:
- Length: Strictly 1 to 2 sentences.
- Tone: Uplifting, epic, formal yet gaming-focused.
- Output ONLY the wish text. No quotation marks, no preamble.`,
        "You are the grand herald of the ATX Family.",
      );
      const fallbackWishes = [
        "May your win streaks stretch into infinity, your reaction times stay lightning-fast, and fortune favor every move you make.",
        "May your vaults overflow with EP, your auction bids land unchallenged, and every arena you grace remember your name.",
        "May your ping stay razor-sharp at single digits and the algorithm bend reality in your favor across every battlefield.",
        "May unmatched clarity guide your hands, every defeat turn into fuel, and your legacy in the ATX Family remain untouchable.",
      ];
      finalWish =
        aiWish?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
        fallbackWishes[hourIndex % fallbackWishes.length];
    }

    const mixedWish = injectThemeEmojis(finalWish, "wish");
    const headerEmoji = getAppEmoji(["blessing", "sparkle", "star"], "✨");

    const wishEmbed = new EmbedBuilder()
      .setColor(0xffd700)
      .setAuthor({
        name: "ATX SACRED BLESSINGS",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `### ${headerEmoji} **${target.username}** Inscribed Blessing <a:penguwritingscript:1571932288869081168>`,
          `> **${mixedWish}**`,
          ``,
        ].join("\n"),
      )
      .setFooter({ text: "May Fortune Favor the Brave" });

    return reply({ content: `${target}`, embeds: [wishEmbed] });
  }

  if (commandName === "joke") {
    const jokeAngles = [
      "Dad Jokes",
      "One-Liners",
      "Knock-Knock Jokes",
      "Puns & Wordplay",
      "Tech & Programming",
      "Office & Corporate Life",
      "School & Student Life",
      "Marriage & Relationships",
      "Parenting & Kids",
      "Animals & Pets",
      "Food & Cooking",
      "Doctors & Hospitals",
      "Lawyers & Courtroom",
      "Travel & Airplanes",
      "Sports & Fitness",
      "Science & Math",
      "History & Politics",
      "Movies & Pop Culture",
      "Superheroes & Comics",
      "Holidays & Festivals",
      "Weather & Seasons",
      "Money & Banking",
      "Dating & Singles",
      "Aging & Seniors",
      "Traffic & Driving",
      "Shopping & Sales",
      "Music & Musicians",
      "Space & Aliens",
      "Ghosts & Spooky",
      "Sarcasm & Dry Humor",
    ];
    const randomAngle =
      jokeAngles[Math.floor(Math.random() * jokeAngles.length)];
    const uniqueNonce = Math.floor(Math.random() * 1000000);

    const aiJoke = await callAiWithFallback(
      `Tell ONE original, hilarious, and punchy gaming joke focused on: "${randomAngle}".
Context Reference ID: #${uniqueNonce}
Rules:
- Format: Deliver strictly as setup and punchline (1-2 short sentences).
- Style: Stand-up banter, relatable gamer pain, and witty irony.
- Output ONLY the joke text itself. No quotation marks, no intro.`,
      "You are a quick-witted stand-up comedian.",
    );

    const offlineJokes = [
      "I told my squad I had an emergency and had to log off. The emergency was my pride after getting wiped in round one.",
      "My doctor told me to avoid stressful situations, so I uninstalled Plato for six minutes.",
      "I don't need an alarm clock. The emotional trauma of blowing an 8-ball shot keeps me awake 24/7.",
      "My internet isn't actually lagging. My brain is just buffering the defeat in high definition.",
      "They say money can't buy happiness, but it can buy enough EP to outbid everyone who laughed at you.",
      "I put 'strategic patience' on my resume because 'camped in a corner waiting for others to lose' sounded unprofessional.",
    ];

    const cleanJoke =
      aiJoke?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
      offlineJokes[Math.floor(Math.random() * offlineJokes.length)];
    const mixedJoke = injectThemeEmojis(cleanJoke, "roast");

    const jokeEmbed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setAuthor({
        name: "ATX STANDUP",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription([`**${mixedJoke}**`, ``].join("\n"))
      .setFooter({ text: "🎭 100% Organic Banter • Try /joke for more" });

    return reply({ embeds: [jokeEmbed] });
  }

  if (commandName === "tossacoin") {
    const isHeads = Math.random() < 0.5;
    const result = isHeads ? "Heads" : "Tails";
    const coinColor = isHeads ? 0xffd700 : 0x00f3ff;

    const tossEmbed = new EmbedBuilder()
      .setColor(coinColor)
      .setAuthor({
        name: "ATX COIN FLIP",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `### <a:fliptossdragcoin:1571936724924239964> Decisive Outcome <a:fliptossdragcoin:1571936724924239964>`,
          `> The coin landed decisively on **${result.toUpperCase()}**`,
        ].join("\n"),
      )
      .setFooter({ text: "Provably Fair 50/50" });

    return reply({ embeds: [tossEmbed] });
  }

  if (commandName === "truthdare" || commandName === "td") {
    const target = targetUser || author;
    const rawMode = (textInput || args[0] || "").toLowerCase().trim();
    let mode = "";
    if (["t", "truth"].includes(rawMode)) mode = "TRUTH";
    else if (["d", "dare"].includes(rawMode)) mode = "DARE";
    else mode = Math.random() < 0.5 ? "TRUTH" : "DARE";

    const isTruth = mode === "TRUTH";
    const truthCategories = [
      "embarrassing gaming losses, toxic excuses, or rage-quitting habits",
      "secret Plato crushes, late-night DMs, or ghosting people",
      "biggest real-life lies told just to stay online and game",
      "spending money or obsessing over virtual clout and leaderboards",
    ];
    const dareCategories = [
      "changing Discord status or bio to something hilarious for 1 hour",
      "typing a ridiculous confession in chat without explaining why",
      "challenging the next person who talks to an immediate 1v1 on Plato",
      "sending an absurd voice note or public apology to another member",
    ];

    const pickedCategory = isTruth
      ? truthCategories[Math.floor(Math.random() * truthCategories.length)]
      : dareCategories[Math.floor(Math.random() * dareCategories.length)];

    const aiLine = await callAiWithFallback(
      `Generate ONE original, spicy PG-13 ${mode} challenge directed at gamer ${target.username}.
Theme: ${pickedCategory}.
Rules:
- Length: Strictly 1 to 2 sentences maximum.
- Tone: Teasing, chaotic, and funny for a Discord gaming community.
- Output ONLY the prompt text. No quotes, no preamble.`,
      "You are the chaotic host of the ATX Truth or Dare arena.",
    );

    const fallbackTruths = [
      "What is the most pathetic excuse you've ever typed in chat after choking an easy win?",
      "Who in this server would you secretly hate losing to the most in a 1v1?",
      "Have you ever ghosted someone in real life just to finish a Plato win streak?",
      "What's the deepest rabbit hole you've fallen into stalking someone's Discord profile?",
    ];
    const fallbackDares = [
      "Set your custom status to 'Certified Bot • Coaching Needed' for the next 1 hour.",
      "Send a DM to the 3rd person in your direct messages saying 'We need to talk' and send no follow-up for 5 minutes.",
      "Ping any admin right now and ask them for permission to breathe in the server.",
      "Drop a 5-second voice note singing the chorus of any pop song or forfeit 50 EP.",
    ];

    const cleanLine =
      aiLine?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
      (isTruth
        ? fallbackTruths[Math.floor(Math.random() * fallbackTruths.length)]
        : fallbackDares[Math.floor(Math.random() * fallbackDares.length)]);

    const mixedLine = injectThemeEmojis(
      cleanLine,
      isTruth ? "general" : "expose",
    );
    const headerEmoji = getAppEmoji(
      isTruth ? ["brain", "smart"] : ["fire", "burn"],
      isTruth ? "🤔" : "🔥",
    );

    const embed = new EmbedBuilder()
      .setColor(isTruth ? 0x00f3ff : 0xff0055)
      .setAuthor({
        name: `ATX ${mode}`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `### ${headerEmoji} ${target}: ${isTruth ? "Moment of Truth" : "Dare Undertaking"}`,
          `> **${mixedLine}**`,
          ``,
          `> <:redcardpenalty:1571939410977620059> **Penalty:** \` Permanent Reputational Damage \``,
          ``,
          `-# **Refusal is an automatic admission of FEAR <a:panickednofear:1571940651417997342>**`,
        ].join("\n"),
      )
      .setFooter({ text: `Lie or Die` });

    return reply({ embeds: [embed] });
  }

  if (commandName === "excuse") {
    const target = targetUser || author;
    const excuseAngles = [
      "999ms ping spike, packet loss, and phantom touch on the touchscreen",
      "an unexpected phone call from a random scammer right at the clutch moment",
      "low battery 20% pop-up notification blocking the entire screen during an 8-ball shot",
      "sunlight reflecting off the screen at a mathematically impossible angle",
      "the game server deliberately rigging RNG against them to protect the opponent",
      "their fingers slipping because their phone was slightly warm",
    ];
    const randomAngle =
      excuseAngles[Math.floor(Math.random() * excuseAngles.length)];
    const uniqueNonce = Math.floor(Math.random() * 1000000);

    const aiExcuse = await callAiWithFallback(
      `Generate ONE absurd, hilarious, and embarrassingly creative gamer excuse explaining why ${target.username} just lost or choked a match.
Angle: ${randomAngle}.
ID: #${uniqueNonce}
Rules:
- Format: Deliver as a direct first-person quote from the player (1-2 sentences maximum).
- Tone: High-tier copium, dramatic, and visibly sweating with excuses.
- Output ONLY the excuse text. No quotation marks, no preamble.`,
      "You are the master of real life copium.",
    );

    const fallbackExcuses = [
      "My phone screen registered a ghost touch from humidity—I literally didn't even tap that!",
      "A 999ms lag spike froze my game right when I had a guaranteed win, but of course it caught up the second I lost.",
      "The 20% battery alert popped up right when I was lining up my final shot. That match was stolen from me.",
      "My little brother bumped my elbow from across the room. Review the match replay, that was not my fault!",
      "The Plato physics engine is clearly bugged on this patch. That angle goes in 100 out of 100 times.",
    ];

    const cleanExcuse =
      aiExcuse?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
      fallbackExcuses[Math.floor(Math.random() * fallbackExcuses.length)];
    const mixedExcuse = injectThemeEmojis(cleanExcuse, "expose");
    const headerEmoji = getAppEmoji(["skull", "rip", "low"], "🤦‍♂️");

    const excuseEmbed = new EmbedBuilder()
      .setColor(0xff9500)
      .setAuthor({
        name: "EMERGENCY EXCUSE",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `### ${headerEmoji} ${target} be like:`,
          `> **"${mixedExcuse}"**`,
          ``,
        ].join("\n"),
      )
      .setFooter({ text: "It was purely a skill issue 🎭" });

    return reply({ content: `${target}`, embeds: [excuseEmbed] });
  }

  return false;
}

module.exports = { handleSocialCommands };
