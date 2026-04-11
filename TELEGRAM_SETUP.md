# Telegram Bot Setup Guide

## 🚀 Quick Setup

### 1. Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow the instructions:
   - Choose a name for your bot (e.g., "AI Character Chat")
   - Choose a username (must end with `_bot`)
4. Save the bot token (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Configure Environment

```bash
# Copy the example configuration
cp .env.telegram .env

# Edit .env with your actual values
nano .env
```

**Required variables:**
- `TELEGRAM_BOT_TOKEN` - Get from BotFather
- `TELEGRAM_WEBHOOK_URL` - Your public HTTPS URL
- `API_KEY` - Your OpenRouter API key

```

#### Option B: Server Deployment

```bash
# Deploy to your server
# Update TELEGRAM_WEBHOOK_URL to your server's HTTPS URL
npm run build
npm run start
```

### 4. Verify Setup

```bash
# Check health status
curl http://localhost:3000/webhook/telegram/health

# Expected response:
{
  "status": "healthy",
  "configured": true,
  "bot": {
    "id": 123456789,
    "username": "your_bot_username",
    "first_name": "AI Character Chat"
  }
}
```

## 🧪 Testing Commands

Once the bot is running, test these commands in Telegram:

```
/start     - Should show welcome message
/help      - Should show all available commands
/characters - Should list available AI characters
/character [name] - Should switch to specified character
/status    - Should show current character and user info
/memory    - Should show memory system information
```

## 🔧 Troubleshooting

### Bot Not Responding

1. **Check server logs:**
   ```bash
   npm run dev
   # Look for Telegram-related errors
   ```

2. **Verify webhook:**
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
   ```

3. **Test webhook manually:**
   ```bash
   curl -X POST http://localhost:3000/webhook/telegram \
     -H "Content-Type: application/json" \
     -d '{"update_id": 123, "message": {"text": "/start", "chat": {"id": YOUR_USER_ID}, "from": {"id": YOUR_USER_ID}}}'
   ```

### Unauthorized Access

If you get "Sorry, you are not authorized to use this bot":

1. Add your Telegram user ID to `TELEGRAM_ALLOWED_USERS`
2. Or set `TELEGRAM_ENABLE_WHITELIST=false`
3. Find your user ID: `@userinfobot` on Telegram

### Webhook Issues

1. **HTTPS required:** Telegram only works with HTTPS URLs
2. **Valid SSL:** Use valid SSL certificates (ngrok works for testing)
3. **Firewall:** Ensure port 3000 is accessible

## 📱 Advanced Configuration

### Enable Image Support

```env
TELEGRAM_ENABLE_IMAGES=true
```

### Enable Voice Messages

```env
TELEGRAM_ENABLE_VOICE=true
```

### Rate Limiting

```env
TELEGRAM_RATE_LIMIT_PER_USER=10    # Messages per minute
TELEGRAM_RATE_LIMIT_WINDOW=60      # Time window in seconds
```

### Admin Features

Add your user ID to `TELEGRAM_ADMIN_USERS` to access:
- `POST /webhook/telegram/set` - Update webhook
- `POST /webhook/telegram/send` - Send messages
- `GET /webhook/telegram/info` - Get webhook info

## 🛡️ Security Best Practices

1. **Always use webhook secret** - Set `TELEGRAM_WEBHOOK_SECRET`
2. **Enable whitelist** - Set `TELEGRAM_ENABLE_WHITELIST=true` in production
3. **Use HTTPS** - Required for Telegram webhooks
4. **Limit admin access** - Only trusted users in `TELEGRAM_ADMIN_USERS`
5. **Monitor logs** - Enable `TELEGRAM_ENABLE_LOGGING=true`

## 📊 Monitoring

### Health Check Endpoint

```bash
curl http://localhost:3000/webhook/telegram/health
```

### Log Monitoring

Enable debug logging:
```env
TELEGRAM_ENABLE_LOGGING=true
DEBUG_REQUESTS=true
```

## 🔄 Resetting Bot

If you need to reset the bot:

```bash
# Clear webhook
curl -X DELETE https://api.telegram.org/bot<TOKEN>/deleteWebhook

# Restart your application
npm run dev
```

## 📞 Support

If you encounter issues:

1. Check server logs for error messages
2. Verify all environment variables are set correctly
3. Test with `/start` command first
4. Check GitHub issues for similar problems
5. Create a new issue with detailed error logs

## 🎉 Success!

Once your bot is working:
- Users can chat with AI characters via Telegram
- All web features are also available
- Long-term memory works across platforms
- Admin can manage bot via API endpoints

Enjoy your AI Character Chat Telegram bot! 🤖
