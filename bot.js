require("dotenv").config();
const {Telegraf,Markup}=require("telegraf");
const fs=require("fs"),path=require("path");
const TOKEN=process.env.BOT_TOKEN, ADMIN=String(process.env.ADMIN_ID||""), CHANNEL=process.env.CHANNEL_USERNAME||"@jyesmsonline12", BKASH=process.env.BKASH_NUMBER||"আপনার bKash নম্বর";
if(!TOKEN||!/^\d+$/.test(ADMIN)){console.error("BOT_TOKEN এবং numeric ADMIN_ID সেট করুন");process.exit(1)}
const bot=new Telegraf(TOKEN), file=path.join(__dirname,"data.json"), sessions=new Map();
function load(){try{return JSON.parse(fs.readFileSync(file))}catch{return {packages:[],proxies:[],orders:[],id:1}}}
let db=load();function save(){fs.writeFileSync(file+".tmp",JSON.stringify(db,null,2));fs.renameSync(file+".tmp",file)}
const admin=c=>String(c.from?.id)===ADMIN, cash=n=>`${Number(n).toFixed(2)} BDT`;
const home=()=>Markup.inlineKeyboard([[Markup.button.callback("🛒 Buy Proxy","shop")],[Markup.button.callback("📦 My Orders","mine"),Markup.button.callback("ℹ️ Help","help")]]);
const panel=()=>Markup.inlineKeyboard([[Markup.button.callback("➕ Add package","addpkg"),Markup.button.callback("💰 Edit price","price")],[Markup.button.callback("📥 Add proxy stock","stock"),Markup.button.callback("📊 Stock","stockview")],[Markup.button.callback("🧾 Pending payments","pending"),Markup.button.callback("📈 Sales","sales")]]);
async function check(c){try{let m=await c.telegram.getChatMember(CHANNEL,c.from.id);if(["creator","administrator","member"].includes(m.status)||(m.status==="restricted"&&m.is_member))return true}catch(e){console.log(e.message)}
await c.reply("আগে আমাদের চ্যানেলে Join করুন, তারপর Joined চাপুন।",Markup.inlineKeyboard([[Markup.button.url("📢 Join Channel",`https://t.me/${CHANNEL.replace("@","")}`)],[Markup.button.callback("✅ Joined","joined")]]));return false}
bot.start(async c=>{if(await check(c))c.reply("🛒 SUPER MARKET-এ স্বাগতম!",home())});
bot.action("joined",async c=>{await c.answerCbQuery();if(await check(c))c.reply("✅ Join যাচাই হয়েছে!",home())});
bot.action("home",async c=>{await c.answerCbQuery();if(await check(c))c.reply("SUPER MARKET",home())});
bot.action("help",c=>c.reply("Proxy বেছে নিন, bKash-এ টাকা পাঠান, TrxID দিন। Admin পেমেন্ট যাচাই করে Approve করলে Proxy পাবেন।"));
bot.action("shop",async c=>{await c.answerCbQuery();if(!(await check(c)))return;let ps=db.packages.filter(p=>db.proxies.some(x=>x.pid===p.id&&!x.sold));if(!ps.length)return c.reply("এখন স্টক নেই।");c.reply("প্যাকেজ বেছে নিন:",Markup.inlineKeyboard(ps.map(p=>[Markup.button.callback(`${p.type} ${p.mb}MB — ${cash(p.price)}`,`buy:${p.id}`)]))});
bot.action(/^buy:(\d+)$/,async c=>{await c.answerCbQuery();if(!(await check(c)))return;let p=db.packages.find(x=>x.id==+c.match[1]);if(!p||!db.proxies.some(x=>x.pid===p.id&&!x.sold))return c.reply("স্টক নেই।");let o={id:db.id++,uid:c.from.id,username:c.from.username||"",pid:p.id,type:p.type,mb:p.mb,price:p.price,status:"trx"};db.orders.push(o);save();sessions.set(c.from.id,{a:"trx",oid:o.id});c.reply(`প্যাকেজ: ${p.type} ${p.mb}MB\nদাম: ${cash(p.price)}\nbKash নম্বর: ${BKASH}\nটাকা পাঠিয়ে Transaction ID লিখে পাঠান।`)});
bot.action("mine",c=>{let a=db.orders.filter(o=>o.uid===c.from.id).slice(-10);c.reply(a.length?a.map(o=>`#${o.id} ${o.type} ${o.mb}MB ${o.status}`).join("\n"):"কোনো অর্ডার নেই।")});
bot.command("admin",c=>admin(c)?c.reply("👑 Admin Panel",panel()):c.reply("⛔ অনুমতি নেই।"));
for(const key of ["addpkg","price","stock","stockview","pending","sales"])bot.action(key,async c=>{await c.answerCbQuery();if(!admin(c))return c.reply("⛔ অনুমতি নেই।");
if(key==="addpkg"){sessions.set(c.from.id,{a:key});return c.reply("প্যাকেজ লিখুন: HTTP 100 20\n(ধরন MB দাম-BDT)")}
if(key==="price"){sessions.set(c.from.id,{a:key});return c.reply("প্যাকেজ ID ও নতুন দাম লিখুন: 1 25")}
if(key==="stock"){sessions.set(c.from.id,{a:key});return c.reply("প্রতি লাইনে লিখুন: প্যাকেজID proxy\nযেমন: 1 host:port:user:pass")}
if(key==="stockview")return c.reply(db.packages.map(p=>`${p.id}. ${p.type} ${p.mb}MB ${cash(p.price)} | স্টক ${db.proxies.filter(x=>x.pid===p.id&&!x.sold).length}`).join("\n")||"প্যাকেজ নেই");
if(key==="sales"){let a=db.orders.filter(o=>o.status==="approved");return c.reply(`সফল অর্ডার: ${a.length}\nমোট বিক্রি: ${cash(a.reduce((s,o)=>s+o.price,0))}`)}
let a=db.orders.filter(o=>o.status==="pending");if(!a.length)return c.reply("Pending payment নেই।");for(let o of a)c.reply(`#${o.id} User:${o.uid}\n${o.type} ${o.mb}MB ${cash(o.price)}\nTrxID: ${o.trx}`,Markup.inlineKeyboard([[Markup.button.callback("✅ Approve & deliver",`ok:${o.id}`),Markup.button.callback("❌ Reject",`no:${o.id}`)]]))});
bot.action(/^ok:(\d+)$/,async c=>{await c.answerCbQuery();if(!admin(c))return c.reply("অনুমতি নেই");let o=db.orders.find(x=>x.id==+c.match[1]&&x.status==="pending"),p=o&&db.proxies.find(x=>x.pid===o.pid&&!x.sold);if(!p)return c.reply("অর্ডার বা স্টক পাওয়া যায়নি");p.sold=true;o.status="approved";save();await bot.telegram.sendMessage(o.uid,`✅ Payment approved!\nআপনার Proxy:\n${p.value}`);c.editMessageReplyMarkup({inline_keyboard:[]});c.reply("Approved; Proxy পাঠানো হয়েছে।")});
bot.action(/^no:(\d+)$/,async c=>{await c.answerCbQuery();if(!admin(c))return;let o=db.orders.find(x=>x.id==+c.match[1]&&x.status==="pending");if(!o)return c.reply("অর্ডার নেই");o.status="rejected";save();bot.telegram.sendMessage(o.uid,"❌ পেমেন্ট Reject হয়েছে। Admin-এর সঙ্গে যোগাযোগ করুন।");c.editMessageReplyMarkup({inline_keyboard:[]})});
bot.on("text",async c=>{let s=sessions.get(c.from.id);if(!s)return;let t=c.message.text.trim();if(s.a==="trx"){let o=db.orders.find(x=>x.id===s.oid&&x.uid===c.from.id&&x.status==="trx");if(!o)return; o.trx=t;o.status="pending";save();sessions.delete(c.from.id);c.reply("TrxID Admin-এর কাছে পাঠানো হয়েছে। যাচাই শেষে Proxy পাবেন।");return bot.telegram.sendMessage(ADMIN,`নতুন পেমেন্ট\nOrder #${o.id}\nUser ${o.uid}\n${o.type} ${o.mb}MB ${cash(o.price)}\nTrxID: ${t}`,Markup.inlineKeyboard([[Markup.button.callback("✅ Approve & deliver",`ok:${o.id}`),Markup.button.callback("❌ Reject",`no:${o.id}`)]]))}
if(!admin(c))return;
if(s.a==="addpkg"){let m=t.match(/^(HTTP|SOCKS5)\s+(\d+)\s+(\d+(?:\.\d+)?)$/i);if(!m)return c.reply("ফরম্যাট: HTTP 100 20");db.packages.push({id:db.id++,type:m[1].toUpperCase(),mb:+m[2],price:+m[3]});save();sessions.delete(c.from.id);return c.reply("প্যাকেজ যোগ হয়েছে।",panel())}
if(s.a==="price"){let m=t.match(/^(\d+)\s+(\d+(?:\.\d+)?)$/),p=m&&db.packages.find(x=>x.id==+m[1]);if(!p)return c.reply("ফরম্যাট: 1 25");p.price=+m[2];save();sessions.delete(c.from.id);return c.reply("দাম পরিবর্তন হয়েছে।",panel())}
if(s.a==="stock"){let n=0;for(let line of t.split(/\r?\n/)){let m=line.match(/^(\d+)\s+(.+)$/),p=m&&db.packages.find(x=>x.id==+m[1]);if(p){db.proxies.push({pid:p.id,value:m[2],sold:false});n++}}save();sessions.delete(c.from.id);return c.reply(`${n}টি Proxy যোগ হয়েছে।`,panel())}});
bot.catch(e=>console.error(e));bot.launch().then(()=>console.log("SUPER MARKET running"));process.once("SIGINT",()=>bot.stop());process.once("SIGTERM",()=>bot.stop());
