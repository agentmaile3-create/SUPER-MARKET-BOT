require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const http = require("http");
const path = require("path");

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || "");
const CHANNEL = process.env.CHANNEL_USERNAME || "@jyesmsonline12";
const BKASH = process.env.BKASH_NUMBER || "";
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL;

if (!TOKEN || !ADMIN_ID || !PUBLIC_URL) {
  console.error("BOT_TOKEN, ADMIN_ID এবং Render URL প্রয়োজন।");
  process.exit(1);
}

const bot = new Telegraf(TOKEN);
const DB_FILE = path.join(__dirname, "data.json");

let db = { packages: [], stock: [], orders: [] };

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (e) {
    console.error("Database পড়া যায়নি:", e.message);
  }
}

db.packages ||= [];
db.stock ||= [];
db.orders ||= [];

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const sessions = new Map();

function isAdmin(ctx) {
  return String(ctx.from.id) === ADMIN_ID;
}

function mainMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🛍️ Proxy কিনুন", "shop")],
    [Markup.button.callback("📦 আমার অর্ডার", "myorders")],
    [Markup.button.callback("ℹ️ সাহায্য", "help")]
  ]);
}

function adminMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📥 Pending Orders", "admin_pending")],
    [Markup.button.callback("📦 Stock দেখুন", "admin_stock")],
    [Markup.button.callback("💰 Sales দেখুন", "admin_sales")],
    [Markup.button.callback("➕ Package / Stock যোগ করার নিয়ম", "admin_help")]
  ]);
}

async function joined(ctx) {
  if (isAdmin(ctx)) return true;

  try {
    const member = await ctx.telegram.getChatMember(CHANNEL, ctx.from.id);
    return ["creator", "administrator", "member"].includes(member.status);
  } catch (e) {
    return false;
  }
}

async function checkJoin(ctx) {
  if (await joined(ctx)) return true;

  await ctx.reply(
    "🔒 বট ব্যবহার করতে আগে আমাদের Telegram চ্যানেলে Join করুন।",
    Markup.inlineKeyboard([
      [Markup.button.url("📢 Join Channel", `https://t.me/${CHANNEL.replace("@", "")}`)],
      [Markup.button.callback("✅ Joined — Check করুন", "check_join")]
    ])
  );
  return false;
}

async function showShop(ctx) {
  const types = ["HTTP", "SOCKS5"];

  await ctx.reply(
    "🛍️ SUPER MARKET PROXY SHOP\n\nআপনার Proxy Type নির্বাচন করুন:",
    Markup.inlineKeyboard(
      types.map(type => [
        Markup.button.callback(
          type === "HTTP" ? "🌐 HTTP Proxy" : "🔐 SOCKS5 Proxy",
          `type:${type}`
        )
      ])
    )
  );
}

bot.start(async ctx => {
  if (!(await checkJoin(ctx))) return;
  await ctx.reply(
    "🟢 স্বাগতম SUPER MARKET-এ!\n\nআপনার প্রয়োজনীয় Proxy কিনতে নিচের মেনু ব্যবহার করুন।",
    mainMenu()
  );
});

bot.action("check_join", async ctx => {
  await ctx.answerCbQuery();
  if (await joined(ctx)) {
    await ctx.reply("✅ Join সফল হয়েছে!", mainMenu());
  } else {
    await ctx.reply("❌ আপনি এখনো চ্যানেলে Join করেননি।");
  }
});

bot.action("shop", async ctx => {
  await ctx.answerCbQuery();
  if (!(await checkJoin(ctx))) return;
  await showShop(ctx);
});

bot.command("shop", async ctx => {
  if (!(await checkJoin(ctx))) return;
  await showShop(ctx);
});

bot.action(/^type:(HTTP|SOCKS5)$/, async ctx => {
  await ctx.answerCbQuery();
  if (!(await checkJoin(ctx))) return;

  const type = ctx.match[1];
  const packages = db.packages.filter(p =>
    p.type === type &&
    db.stock.some(s => s.type === type && s.mb === p.mb && !s.used)
  );

  if (!packages.length) {
    return ctx.reply("❌ এই Proxy Type-এর কোনো Package এখন Stock-এ নেই।");
  }

  await ctx.reply(
    `📦 ${type} Proxy Package নির্বাচন করুন:`,
    Markup.inlineKeyboard(
      packages.map(p => {
        const count = db.stock.filter(s =>
          s.type === type && s.mb === p.mb && !s.used
        ).length;

        return [Markup.button.callback(
          `${p.mb} MB — ৳${p.price} (Stock: ${count})`,
          `buy:${type}:${p.mb}`
        )];
      })
    )
  );
});

bot.action(/^buy:(HTTP|SOCKS5):(\d+)$/, async ctx => {
  await ctx.answerCbQuery();
  if (!(await checkJoin(ctx))) return;

  const type = ctx.match[1];
  const mb = Number(ctx.match[2]);
  const pkg = db.packages.find(p => p.type === type && p.mb === mb);
  const available = db.stock.some(s =>
    s.type === type && s.mb === mb && !s.used
  );

  if (!pkg || !available) {
    return ctx.reply("❌ দুঃখিত, এই Package এখন Stock-এ নেই।");
  }

  sessions.set(ctx.from.id, { type, mb });

  await ctx.reply(
    `🧾 আপনার অর্ডার:\n\nProxy: ${type}\nPackage: ${mb} MB\nমূল্য: ৳${pkg.price}\n\n` +
    `💳 bKash Number: ${BKASH || "Admin-এর সঙ্গে যোগাযোগ করুন"}\n\n` +
    "উপরের নম্বরে টাকা পাঠিয়ে আপনার Transaction ID (TrxID) লিখে পাঠান।\n\n" +
    "⚠️ Admin টাকা যাচাই করে Approve করলে Proxy দেওয়া হবে।"
  );
});

bot.action("myorders", async ctx => {
  await ctx.answerCbQuery();
  if (!(await checkJoin(ctx))) return;

  const orders = db.orders.filter(o => o.userId === ctx.from.id).slice(-10);

  if (!orders.length) return ctx.reply("আপনার কোনো অর্ডার নেই।");

  const text = orders.map(o =>
    `#${o.id} | ${o.type} ${o.mb} MB | ${o.status}`
  ).join("\n");

  await ctx.reply("📦 আপনার অর্ডারসমূহ:\n\n" + text);
});

bot.action("help", async ctx => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "ℹ️ সাহায্য:\n\n১. Proxy Type নির্বাচন করুন।\n২. Package নির্বাচন করুন।\n৩. bKash-এ টাকা পাঠান।\n৪. TrxID পাঠান।\n৫. Admin যাচাই করে Approve করলে Proxy পাবেন।"
  );
});

bot.command("admin", async ctx => {
  if (!isAdmin(ctx)) return;
  await ctx.reply("🔐 SUPER MARKET ADMIN PANEL", adminMenu());
});

bot.action("admin_pending", async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("অনুমতি নেই।");
  await ctx.answerCbQuery();

  const pending = db.orders.filter(o => o.status === "pending");
  if (!pending.length) return ctx.reply("কোনো Pending Order নেই।");

  for (const o of pending) {
    await ctx.reply(
      `🧾 Order #${o.id}\nUser ID: ${o.userId}\nProxy: ${o.type}\nPackage: ${o.mb} MB\nTrxID: ${o.trxid}\nমূল্য: ৳${o.price}`,
      Markup.inlineKeyboard([[
        Markup.button.callback("✅ Approve", `approve:${o.id}`),
        Markup.button.callback("❌ Reject", `reject:${o.id}`)
      ]])
    );
  }
});

bot.action("admin_stock", async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("অনুমতি নেই।");
  await ctx.answerCbQuery();

  const lines = db.packages.map(p => {
    const count = db.stock.filter(s =>
      s.type === p.type && s.mb === p.mb && !s.used
    ).length;
    return `${p.type} ${p.mb} MB | ৳${p.price} | Stock: ${count}`;
  });

  await ctx.reply(lines.length ? lines.join("\n") : "কোনো Package নেই।");
});

bot.action("admin_sales", async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("অনুমতি নেই।");
  await ctx.answerCbQuery();

  const sales = db.orders.filter(o => o.status === "approved");
  const total = sales.reduce((sum, o) => sum + Number(o.price), 0);

  await ctx.reply(
    `💰 মোট বিক্রি: ${sales.length}\nমোট টাকা: ৳${total}`
  );
});

bot.action("admin_help", async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("অনুমতি নেই।");
  await ctx.answerCbQuery();

  await ctx.reply(
    "➕ Package যোগ:\n/addpkg HTTP 100 50\n\n" +
    "এখানে 100 = MB, 50 = দাম (টাকা)।\n\n" +
    "📥 Proxy Stock যোগ:\n/stock HTTP 100 proxy-address:port:user:pass\n\n" +
    "একইভাবে SOCKS5-ও যোগ করা যাবে।\n\n" +
    "📋 Pending Orders: /pending\n" +
    "📦 Stock: /stockview\n" +
    "💰 Sales: /sales"
  );
});

bot.command("addpkg", async ctx => {
  if (!isAdmin(ctx)) return;

  const [, type, mbText, priceText] = ctx.message.text.trim().split(/\s+/);
  const mb = Number(mbText);
  const price = Number(priceText);
  const normalizedType = String(type || "").toUpperCase();

  if (!["HTTP", "SOCKS5"].includes(normalizedType) ||
      !Number.isInteger(mb) || mb <= 0 ||
      !Number.isFinite(price) || price <= 0) {
    return ctx.reply("ব্যবহার করুন:\n/addpkg HTTP 100 50");
  }

  const existing = db.packages.find(p =>
    p.type === normalizedType && p.mb === mb
  );

  if (existing) existing.price = price;
  else db.packages.push({ type: normalizedType, mb, price });

  save();
  await ctx.reply(`✅ ${normalizedType} ${mb} MB Package-এর দাম ৳${price} সেট হয়েছে।`);
});

bot.command("stock", async ctx => {
  if (!isAdmin(ctx)) return;

  const parts = ctx.message.text.trim().split(/\s+/);
  const type = String(parts[1] || "").toUpperCase();
  const mb = Number(parts[2]);
  const proxy = parts.slice(3).join(" ");

  if (!["HTTP", "SOCKS5"].includes(type) ||
      !Number.isInteger(mb) || mb <= 0 || !proxy) {
    return ctx.reply("ব্যবহার করুন:\n/stock HTTP 100 proxy-address:port:user:pass");
  }

  if (!db.packages.some(p => p.type === type && p.mb === mb)) {
    return ctx.reply("আগে এই Package তৈরি করুন। উদাহরণ:\n/addpkg HTTP 100 50");
  }

  db.stock.push({
    id: Date.now().toString(),
    type,
    mb,
    proxy,
    used: false
  });

  save();
  await ctx.reply("✅ Proxy Stock-এ যোগ হয়েছে।");
});

bot.command("pending", async ctx => {
  if (!isAdmin(ctx)) return;
  await ctx.reply("Pending Orders দেখতে /admin চাপুন।");
});

bot.command("stockview", async ctx => {
  if (!isAdmin(ctx)) return;
  const count = db.stock.filter(s => !s.used).length;
  await ctx.reply(`📦 মোট Available Proxy: ${count}`);
});

bot.command("sales", async ctx => {
  if (!isAdmin(ctx)) return;
  const sales = db.orders.filter(o => o.status === "approved");
  const total = sales.reduce((sum, o) => sum + Number(o.price), 0);
  await ctx.reply(`💰 Sales: ${sales.length}\nমোট: ৳${total}`);
});

bot.action(/^approve:(\d+)$/, async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("অনুমতি নেই।");
  await ctx.answerCbQuery();

  const order = db.orders.find(o => o.id === ctx.match[1]);
  if (!order || order.status !== "pending") {
    return ctx.reply("এই Order আর Pending নেই।");
  }

  const item = db.stock.find(s =>
    s.type === order.type && s.mb === order.mb && !s.used
  );

  if (!item) return ctx.reply("❌ এই Package-এর Stock নেই।");

  item.used = true;
  order.status = "approved";
  order.proxy = item.proxy;
  save();

  await ctx.telegram.sendMessage(
    order.userId,
    `✅ আপনার Payment Admin যাচাই করেছেন!\n\n🎉 আপনার Proxy:\n\n${item.proxy}\n\nধন্যবাদ SUPER MARKET ব্যবহার করার জন্য।`
  );

  await ctx.editMessageText(`✅ Order #${order.id} Approved হয়েছে।`);
});

bot.action(/^reject:(\d+)$/, async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("অনুমতি নেই।");
  await ctx.answerCbQuery();

  const order = db.orders.find(o => o.id === ctx.match[1]);
  if (!order || order.status !== "pending") {
    return ctx.reply("এই Order আর Pending নেই।");
  }

  order.status = "rejected";
  save();

  await ctx.telegram.sendMessage(
    order.userId,
    `❌ আপনার Order #${order.id} Reject করা হয়েছে। প্রয়োজনে Admin-এর সঙ্গে যোগাযোগ করুন।`
  );

  await ctx.editMessageText(`❌ Order #${order.id} Reject হয়েছে।`);
});

bot.on("text", async ctx => {
  if (ctx.message.text.startsWith("/")) return;

  const session = sessions.get(ctx.from.id);
  if (!session) return;

  if (!(await checkJoin(ctx))) return;

  const trxid = ctx.message.text.trim();
  if (trxid.length < 4 || trxid.length > 100) {
    return ctx.reply("সঠিক Transaction ID পাঠান।");
  }

  const pkg = db.packages.find(p =>
    p.type === session.type && p.mb === session.mb
  );

  const order = {
    id: Date.now().toString(),
    userId: ctx.from.id,
    type: session.type,
    mb: session.mb,
    price: pkg ? pkg.price : 0,
    trxid,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  db.orders.push(order);
  save();
  sessions.delete(ctx.from.id);

  await ctx.reply(
    "✅ আপনার TrxID Admin-এর কাছে পাঠানো হয়েছে।\nPayment যাচাই শেষে Admin Approve করলে Proxy পাবেন।"
  );

  await ctx.telegram.sendMessage(
    ADMIN_ID,
    `🔔 নতুন Payment Request!\n\nOrder: #${order.id}\nUser ID: ${order.userId}\nProxy: ${order.type}\nPackage: ${order.mb} MB\nTrxID: ${order.trxid}\nদাম: ৳${order.price}`,
    Markup.inlineKeyboard([[
      Markup.button.callback("✅ Approve", `approve:${order.id}`),
      Markup.button.callback("❌ Reject", `reject:${order.id}`)
    ]])
  );
});

bot.catch((err, ctx) => {
  console.error("Bot error:", err);
});

const webhookHandler = bot.webhookCallback("/telegram");

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("SUPER MARKET BOT is running");
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }

  if (req.url === "/telegram") {
    return webhookHandler(req, res);
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, async () => {
  try {
    await bot.telegram.setWebhook(`${PUBLIC_URL}/telegram`);
    console.log("SUPER MARKET BOT webhook is running.");
  } catch (err) {
    console.error("Webhook setup error:", err);
  }
});
