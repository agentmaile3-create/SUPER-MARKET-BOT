# SUPER MARKET Bot
Node.js 18+ Telegram bot for HTTP/SOCKS5 proxy packages, required channel join, bKash TrxID submission, admin review and delivery after approval.

## Setup
1. Keep this repository private if possible. Never commit `.env`, `data.json`, bot token, or proxy credentials.
2. Copy `.env.example` to `.env` locally or set the same variables in your hosting dashboard:
   - `BOT_TOKEN`: BotFather token
   - `ADMIN_ID`: your numeric Telegram user ID (not username)
   - `CHANNEL_USERNAME=@jyesmsonline12`
   - `BKASH_NUMBER`: your payment number
3. Run `npm install` then `npm start` on a host supporting a persistent Node.js process and persistent disk.
4. Add the bot as a channel administrator. Send `/start`; admin sends `/admin`.

Admin: Add package format `HTTP 100 20` or `SOCKS5 500 50`; edit price format `packageID price`; add stock format `packageID proxy-value` (one per line).

IMPORTANT: bKash TrxID is sent to the admin for MANUAL verification. The bot cannot independently confirm a personal bKash transfer. Only press Approve after checking the actual payment. Approve delivers one unsold proxy from stock. Use only proxy inventory you own or are authorized to sell. JSON storage requires persistent disk on hosting.
