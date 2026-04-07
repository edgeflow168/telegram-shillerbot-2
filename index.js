const { Telegraf, session } = require("telegraf");

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

if (!BOT_TOKEN) {
  throw new Error("Missing BOT_TOKEN in environment variables");
}

const bot = new Telegraf(BOT_TOKEN);

bot.use(session());

const userStates = new Map();
const recentReplies = new Map();

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(probability) {
  return Math.random() < probability;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(text = "") {
  return text.toLowerCase().trim();
}

function addHumanTypos(text) {
  if (!chance(0.18)) return text;

  const typoRules = [
    (t) => t.replace(/\bI am\b/gi, "i am"),
    (t) => t.replace(/\bI'm\b/g, "im"),
    (t) => t.replace(/\byou\b/gi, "u"),
    (t) => t.replace(/\bthanks\b/gi, "thx"),
    (t) => t.replace(/\bthe\b/gi, "da"),
    (t) => t.replace(/\bvery\b/gi, "vry"),
    (t) => t.replace(/\bgoing\b/gi, "goin"),
    (t) => t.replace(/\btonight\b/gi, "tonite")
  ];

  let result = text;
  const edits = randomInt(1, 2);
  for (let i = 0; i < edits; i++) {
    result = pick(typoRules)(result);
  }
  return result;
}

function avoidSameReply(chatId, newReply) {
  const last = recentReplies.get(chatId);
  if (last === newReply) return false;
  recentReplies.set(chatId, newReply);
  return true;
}

async function humanReply(ctx, text, extra = {}) {
  let delayMs;

  if (chance(0.3)) {
    delayMs = randomInt(30000, 60000);
  } else if (chance(0.5)) {
    delayMs = randomInt(60000, 120000);
  } else {
    delayMs = randomInt(180000, 300000);
  }

  await sleep(delayMs);

  if (chance(0.12)) {
    await ctx.sendChatAction("typing");
    await sleep(randomInt(3000, 9000));
  }

  let finalText = addHumanTypos(text);

  if (!avoidSameReply(ctx.chat.id, finalText) && chance(0.7)) {
    return;
  }

  await ctx.reply(finalText, {
    reply_to_message_id: ctx.message.message_id,
    ...extra
  });
}

function getUserState(userId) {
  if (!userStates.has(userId)) {
    userStates.set(userId, {
      lastIntent: null,
      lastSeenAt: Date.now()
    });
  }
  return userStates.get(userId);
}

function updateUserState(userId, patch) {
  const current = getUserState(userId);
  userStates.set(userId, { ...current, ...patch, lastSeenAt: Date.now() });
}

const GREETINGS = [
  "Good morning fam",
  "Gm fam ☀️",
  "Gm gm",
  "Morning mate",
  "Good morning ser",
  "Gm legend"
];

const HOW_ARE_YOU_REPLIES = [
  "I am fine thank you, you?",
  "Im good hehe, u?",
  "All good here, how bout u?",
  "Doing well fam, u?",
  "Pretty good today, you?"
];

const AWESOME_REPLIES = [
  "😎",
  "🔥",
  "🙌",
  "Niceee",
  "Love that",
  "LFG",
  "Lets gooo"
];

const THANKS_REPLIES = [
  "Always fam",
  "No worries",
  "Anytime mate",
  "Gotchu",
  "Hehe anytime"
];

const GENERAL_FRIENDLY = [
  "Haha fair enough",
  "Nice one",
  "Love the vibe here",
  "Real talk",
  "That sounds good ngl",
  "Yea thats true",
  "Haha valid"
];

const SOFT_SHILL_LINES = [
  "Btw if anyone still exploring, feel free to check the pinned message when free 👀",
  "Quiet reminder fam, some useful updates are in pinned if u missed them",
  "For new peeps here, pinned has the basic stuff and links 🤝",
  "Not financial advice obviously but worth checking the latest update in pinned",
  "If ur still reading things up, roadmap and key links are in pinned",
  "Small reminder, the main info is already in pinned so its easier for everyone"
];

function detectIntent(text) {
  const t = normalize(text);

  if (/^(gm|gm gm|good morning|morning|mornin)\b/.test(t)) return "gm";
  if (/(how are you|how r you|how are u|hows it going|how's it going|u good|you good)/.test(t)) return "how_are_you";
  if (/\b(awesome|great|nice|cool|good|amazing|lets go|let's go|solid)\b/.test(t)) return "positive";
  if (/\b(thank you|thanks|thx|ty)\b/.test(t)) return "thanks";

  return "general";
}

function shouldReply(ctx, intent) {
  const isPrivate = ctx.chat.type === "private";

  if (isPrivate) return true;

  if (intent === "gm") return chance(0.95);
  if (intent === "how_are_you") return chance(0.85);
  if (intent === "positive") return chance(0.65);
  if (intent === "thanks") return chance(0.70);

  return chance(0.9);
}

bot.start(async (ctx) => {
  await ctx.reply("hey fam, im here 👋");
});

bot.on("text", async (ctx) => {
  try {
    const text = ctx.message.text || "";
    const userId = ctx.from.id;
    const state = getUserState(userId);
    const intent = detectIntent(text);

    if (!shouldReply(ctx, intent)) return;

    const lowered = normalize(text);

    if (
      lowered.startsWith("/") ||
      lowered.includes("http://") ||
      lowered.includes("https://")
    ) {
      return;
    }

    if (intent === "gm") {
      updateUserState(userId, { lastIntent: "gm" });
      return humanReply(ctx, pick(GREETINGS));
    }

    if (intent === "how_are_you") {
      if (state.lastIntent === "gm" || chance(0.7)) {
        updateUserState(userId, { lastIntent: "how_are_you" });
        return humanReply(ctx, pick(HOW_ARE_YOU_REPLIES));
      }
    }

    if (intent === "positive") {
      if (state.lastIntent === "how_are_you" || chance(0.6)) {
        updateUserState(userId, { lastIntent: "positive" });
        return humanReply(ctx, pick(AWESOME_REPLIES));
      }
    }

    if (intent === "thanks") {
      updateUserState(userId, { lastIntent: "thanks" });
      return humanReply(ctx, pick(THANKS_REPLIES));
    }

    if (chance(0.2)) {
      updateUserState(userId, { lastIntent: "general" });
      return humanReply(ctx, pick(GENERAL_FRIENDLY));
    }
  } catch (err) {
    console.error("Message handler error:", err);
  }
});

async function runSoftShill() {
  if (!GROUP_CHAT_ID) {
    console.log("GROUP_CHAT_ID not set, skipping scheduled soft shill");
    return;
  }

  const line = pick(SOFT_SHILL_LINES);

  try {
    await bot.telegram.sendChatAction(GROUP_CHAT_ID, "typing");
    await sleep(randomInt(3000, 9000));
    await bot.telegram.sendMessage(GROUP_CHAT_ID, addHumanTypos(line));
    console.log("Soft shill sent:", line);
  } catch (err) {
    console.error("Soft shill send error:", err.message);
  }
}

function scheduleNextSoftShill() {
  const minMinutes = 45;
  const maxMinutes = 180;
  const nextMs = randomInt(minMinutes * 60 * 1000, maxMinutes * 60 * 1000);

  console.log(`Next soft shill in ${Math.round(nextMs / 60000)} minutes`);

  setTimeout(async () => {
    if (chance(0.75)) {
      await runSoftShill();
    } else {
      console.log("Skipped one soft shill cycle intentionally");
    }
    scheduleNextSoftShill();
  }, nextMs);
}

bot.catch((err) => {
  console.error("Bot error:", err);
});

bot.launch().then(() => {
  console.log("Bot is running...");
  scheduleNextSoftShill();
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
