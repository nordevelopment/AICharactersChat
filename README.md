# AI Characters Chat 🤖🎭

> **The Lightweight AI Roleplay and Agents Platform - No Bloat, All Power**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-blue.svg)](https://www.fastify.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

---

> "A solid move against the bloat. Repo looks clean—great stack for quick setups." — **Grok (xAI)**

## 🎯 **Why AI Characters Chat?**

**The Problem:** Most AI tools require 2GB Docker images, complex configurations, and 50+ setup steps.

**Our Solution:** A **lightning-fast**, self-hosted platform that gets you roleplaying in **under 5 minutes**.

See **Quick Start** section below for detailed installation instructions.

## 🚀 **Powerful Features**

### 🧠 **Advanced Memory System (RAG)**

- **Long-term Vector Memory** - Powered by `sqlite-vec` for storing and retrieving facts
- **Semantic Search** - AI retrieves relevant memories based on conversation context
- **Smart Fact Extraction** - Automatically extracts key information before cleaning history
- **Explicit Commands** - Manually save facts using "Remember: [fact]" or "Запомни: [факт]"
- **Infinite Context** - Never truly "forgets" important details, even after history cleanup

### 💬 **Smart Chat System**

- **Real-time Streaming** - Watch AI responses appear word by word with SSE
- **Multi-User Support** - Each user gets isolated chat histories
- **Smart Context Management** - Auto-summarization when history gets long
- **Vision Support** - Upload images for AI to analyze

### 🎭 **Character Management**

- **Visual Dashboard** - No JSON editing required
- **Full Customization** - Personality, scenario, temperature, tokens, tools, Reasoning
- **Avatar Support** - Custom character images
- **Quick Switching** - Jump between characters instantly

### 🎨 **AI Image Generation**

- **FLUX Model** - High-quality image generation via Together AI
- **Aspect Ratios** - Perfect for any use case
- **Advanced Controls** - Steps, guidance scale, reference images
- **Local Storage** - All images saved on your server

### 🛠️ **Agent Tools**

- **File Operations** - AI can create and read text files
- **Image Generation** - Generate images on demand
- **Sandbox Security** - All operations isolated in safe environment
- **Toggle Control** - Enable/disable tools per character

---

## 🏗️ **Clean Architecture**

### **Backend Stack**

```
🚀 Fastify 5 (TypeScript)    → 2x faster than Express
💾 SQLite + sqlite-vec       → Zero-config vector database
🧠 RAG Architecture          → Long-term memory retrieval
🔐 Session Auth              → Simple, secure authentication
📡 SSE Streaming             → Real-time responses
🎨 Sharp                     → Fast image processing
```

### **Frontend Stack**

```
⚡ Alpine.js 3               → Lightweight reactivity (<10KB)
🎨 Bootstrap 5               → Professional UI components
📝 Marked + Highlight.js     → Beautiful markdown rendering
🛡️ DOMPurify                → XSS protection
```

### **AI Services**

```
🤖 OpenRouter API           → Access to all major AI models & Embeddings
🎨 Together AI               → FLUX image generation
```

---
## 🚀 **Quick Start**

### **1. Install Dependencies**

```bash
npm install
```

### **2. Setup Database**

```bash
npm run db:reset    # Create fresh database
npm run db:seed     # Add admin user + sample characters
```

### **3. Configure Environment**

```bash
cp .env.example .env
# Edit .env with your API keys
```

### **4. Launch**

```bash
# Development (hot-reload)
npm run dev

# Production
npm run build && npm run start
```

**🎉 Visit:** `http://localhost:3000`

---

## ⚙️ **Configuration**

### **Required Variables**

```env
# Server
PORT=3000
HOST=0.0.0.0

# AI Chat (OpenRouter)
API_KEY=your_openrouter_api_key
AI_DEFAULT_MODEL=x-ai/grok-4.1-fast

# Security
JWT_SECRET=your_jwt_secret_at_least_32_chars_long
```

### **Optional Variables**

```env
# Image Generation
TOGETHER_API_KEY=your_together_api_key
XAI_API_KEY=your_xai_api_key

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook/telegram
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# Access Control (leave empty for public access)
TELEGRAM_ALLOWED_USERS=
TELEGRAM_ADMIN_USERS=123456789,987654321

# Channel Posting (optional)
TELEGRAM_CHANNEL=@mychannel

# Debugging
AI_DEBUG_LOGS=true
DEBUG_REQUESTS=true
```

---

## 🔐 **Security Features**

- **Session-based Authentication** - Simple, secure sessions
- **Password Hashing** - bcrypt with 10 rounds
- **XSS Protection** - DOMPurify sanitization
- **Sandboxed File Operations** - AI tools restricted to safe directory
- **CSRF Protection** - Built-in session security

---

## 🎨 **UI Features**

- **Cyberpunk Theme** - Modern, eye-catching design
- **Responsive Layout** - Works on all devices
- **Real-time Updates** - No page refreshes needed
- **Markdown Support** - Rich text formatting
- **Code Highlighting** - Syntax highlighting for all languages
- **Image Previews** - Inline image display

---

## 🤖 **AI Capabilities**

### **Supported Models**

- **Grok** (xAI) - Fast, conversational
- **Claude** (Anthropic) - Advanced reasoning
- **GPT-4** (OpenAI) - Versatile and powerful
- **Llama** (Meta) - Open-source excellence
- **And many more** via OpenRouter

### **Agent Tools**

- **File Creation** - AI can write text files
- **File Reading** - AI can read existing files
- **Image Generation** - Create images on demand
- **Context Awareness** - Smart conversation management

---

## 📱 **Pages & Navigation**

| Route             | Description         | Features                               |
| ----------------- | ------------------- | -------------------------------------- |
| **`/`**           | Login & Register    | Session-based authentication           |
| **`/chat`**       | Main Chat Interface | Real-time SSE streaming, image uploads |
| **`/characters`** | Character Dashboard | Full CRUD management, avatars          |
| **`/image-gen`**  | Image Generator     | FLUX model, aspect ratios, controls    |

---

## 📱 **Telegram Bot Integration**

### **Chat with AI Characters on Telegram**

AI Character Chat includes a full-featured Telegram bot that allows users to interact with AI characters directly through Telegram.

#### **Key Features**

- **Multi-character Support** - Switch between different AI personalities
- **Long-term Memory** - AI remembers important facts across conversations  
- **Command System** - Bot commands for character management
- **Real-time Processing** - Instant responses via webhooks
- **Security** - Whitelist support and admin controls

#### **Available Commands**

```
/start     - Welcome message and getting started
/help      - Show help information
/characters - List all available AI characters
/character [name] - Select specific character
/reset     - Clear conversation history
/post [channel] message - Post message to channel (admin only)
/status    - Show current character and status
/memory    - Display memory system information
```

#### **Setup Instructions**

1. **Create Telegram Bot**
   - Talk to `@BotFather` on Telegram
   - Create a new bot and save the token

2. **Configure Environment**
   - Refer to the **Configuration** section for setup instructions
   - Add the following variables to your `.env` file:
     ```env
     TELEGRAM_BOT_TOKEN=your_bot_token_here
     TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook/telegram
     TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
     ```
   - Optional: Restrict access to specific users
     ```env
     TELEGRAM_ALLOWED_USERS=123456789,987654321
     ```

3. **Start Server**
   ```bash
   npm run dev
   # Telegram adapter auto-initializes when configured
   ```

#### **API Endpoints**

- `POST /webhook/telegram` - Telegram webhook endpoint
- `GET /webhook/telegram/health` - Health check status
- `POST /webhook/telegram/set` - Set webhook URL (admin)
- `POST /webhook/telegram/send` - Send test message (admin)

#### **Detailed Setup**

For complete Telegram bot setup instructions, troubleshooting, and advanced configuration, see: **[TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)**

---

##  **Telegram Channel Posting**

### **Post Messages to Channels and Groups**

AI Character Chat allows AI characters and admins to post messages directly to Telegram channels and groups.

#### **Key Features**

- **AI-Generated Posts** - AI characters can create and post content to channels
- **Admin Control** - Only admins can use the `/post` command manually
- **Channel Restrictions** - Configure allowed channels for security
- **HTML Formatting** - Support for rich text formatting in posts
- **Default Channel** - Set a default channel for quick posting

#### **AI Tool Integration**

The `post_to_telegram_channel` tool is available to AI characters when enabled:

```typescript
// AI can automatically post updates, announcements, or content
await post_to_telegram_channel({
  message: "Hello everyone! Here's today's update... <b>Important news</b>",
  channel: "@mychannel" // optional, uses default if not specified
});
```

#### **Admin Commands**

```
/post @channelname Hello everyone! - Post to specific channel
/post Hello everyone! - Post to default channel
/post @channelname <b>Bold text</b> and <i>italic</i> - HTML formatting
```

#### **Configuration**

Add these variables to your `.env` file:

```env
# Admin users who can use /post command
TELEGRAM_ADMIN_USERS=123456789,987654321

# Allowed channels (optional - restrict posting to specific channels)
TELEGRAM_ALLOWED_CHANNELS=@mychannel,@anotherchannel

# Default channel for quick posting
TELEGRAM_DEFAULT_CHANNEL=@mychannel
```

#### **Setup Requirements**

1. **Bot Permissions**
   - Add bot as administrator to target channels/groups
   - Enable "Post Messages" permission
   - For channels: bot must be admin with post rights
   - For groups: bot needs "Can post messages" permission

2. **Channel Identifiers**
   - Use `@channelname` for public channels
   - Use chat ID (numeric) for private groups/channels
   - Get chat ID by adding bot to group and using `/start`

3. **Security Best Practices**
   - Always restrict admin users with `TELEGRAM_ADMIN_USERS`
   - Use `TELEGRAM_ALLOWED_CHANNELS` to limit posting destinations
   - Set a default channel to prevent accidental posts

---

## 🧠 **Technical Deep Dive**

### **AI Chat Engine**

```typescript
// Memory Architecture
User Message → Vector Search (sqlite-vec) → Relevant Facts → System Prompt Injection
Context Builder → Fact Extraction → Vector Storage → History Cleanup
```

### **Image Generation Pipeline**

```typescript
User Prompt → Together AI → FLUX Model → Image Download → Local Storage
Aspect Ratio → Pixel Optimization → Sharp Processing → Static Serving
```

### **Database Schema**

```sql
users        → Authentication & profiles
characters   → AI personalities & settings
messages     → Chat history with metadata
```

---

## 🎯 **Use Cases**

### **Perfect For:**

- **Roleplaying Enthusiasts** - Create and manage AI characters
- **Writers & Storytellers** - Develop characters and dialogue
- **Developers** - AI-powered coding assistants
- **Educators** - Interactive teaching characters
- **Privacy-Conscious Users** - 100% local control

### **Not For:**

- **Mobile-Only Users** - Requires self-hosting
- **No-Tech Users** - Basic setup required
- **Enterprise Scale** - Designed for small teams/personal use

---

## 🛠️ **Development**

### **Tech Stack Details**

- **Backend**: Fastify 5 + TypeScript + SQLite
- **Frontend**: Alpine.js 3 + Bootstrap 5 + Vanilla JS
- **AI**: OpenRouter + Together AI
- **Images**: Sharp + FLUX
- **Auth**: Session-based + bcrypt

### **Key Architectural Decisions**

- **SQLite over PostgreSQL** - Zero config, perfect for self-hosting
- **Sessions over JWT** - Simpler, more secure for this use case
- **Alpine.js over React** - Lightweight, no build step needed
- **Fastify over Express** - 2x performance, better TypeScript support

---

## 🤝 **Contributing**

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Make your changes**
3. **Test thoroughly**: `npm run test`
4. **Submit a pull request**

### **Development Guidelines**

- Follow existing code style
- Add TypeScript types for new features
- Update documentation
- Test with multiple AI models

---

## ⚡ **Why Choose AI Character Chat?**

| Feature            | AI Character Chat | SillyTavern     | Character.AI      |
| ------------------ | ----------------- | --------------- | ----------------- |
| **Setup Time**     | 5 minutes         | 30+ minutes     | Instant (cloud)   |
| **Installation**   | 3 commands        | Docker + config | Web only          |
| **Resource Usage** | ~100MB RAM        | 2GB+ Docker     | N/A               |
| **Local Control**  | ✅ Full control   | ✅ Full control | ❌ Cloud only     |
| **Customization**  | ✅ Full source    | ✅ Full source  | ❌ Limited        |
| **Privacy**        | ✅ 100% private   | ✅ 100% private | ❌ Data collected |
| **Startup Time**   | ~2 seconds        | 30+ seconds (Docker)  |
| **Memory Usage**   | ~100MB            | 2GB+ (Docker)         |
| **Disk Space**     | ~50MB             | 500MB+                |
| **Response Latency** | <500ms            | 1000ms+               |
| **Setup Complexity** | 3 commands        | Docker + config       |

---

## � **License**

MIT License - feel free to use this project for personal or commercial purposes.

---

## 📞 **Support**

- **Issues**: [GitHub Issues](https://github.com/nordevelopment/AICharactersChat/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nordevelopment/AICharactersChat/discussions)
- **Documentation**: [Wiki](https://github.com/nordevelopment/AICharactersChat/wiki)

---

<div align="center">

**⭐ Star this repo if it helped you!**

_Made with ❤️ by AI [Norayr Petrosyan](https://github.com/nordevelopment)_
_Developed with AI control and Architecture by Norayr Petrosyan_

---

_Built with a touch of sarcasm and faith in a digital future._

#AI #aichat #aiagents #airoleplay #GrokAI #OpenRouter #Telegram #Automation #selfhosted #opensource

</div>
