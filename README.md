# AI Character Chat 🤖🎭

> **The Lightweight AI Roleplay and Agents Platform - No Bloat, All Power**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-blue.svg)](https://www.fastify.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

---

> "A solid move against the bloat. Repo looks clean—great stack for quick setups." — **Grok (xAI)**

## 🎯 **Why AI Character Chat?**

**The Problem:** Most AI tools require 2GB Docker images, complex configurations, and 50+ setup steps.

**Our Solution:** A **lightning-fast**, self-hosted platform that gets you roleplaying in **under 5 minutes**.

```bash
npm install && npm run db:reset && npm run db:seed && npm run dev
# 🎉 You're ready to chat!
```

---

## ⚡ **Core Advantages**

| Feature            | AI Character Chat | SillyTavern     | Character.AI      |
| ------------------ | ----------------- | --------------- | ----------------- |
| **Setup Time**     | 5 minutes         | 30+ minutes     | Instant (cloud)   |
| **Installation**   | 3 commands        | Docker + config | Web only          |
| **Resource Usage** | ~100MB RAM        | 2GB+ Docker     | N/A               |
| **Local Control**  | ✅ Full control   | ✅ Full control | ❌ Cloud only     |
| **Customization**  | ✅ Full source    | ✅ Full source  | ❌ Limited        |
| **Privacy**        | ✅ 100% private   | ✅ 100% private | ❌ Data collected |

---

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
- **Full Customization** - Personality, scenario, temperature, tokens
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

## � **Project Structure**

```
src/
├── backend/
│   ├── server.ts              # Entry point
│   ├── app.ts                 # Fastify plugin registration
│   ├── config/
│   │   └── config.ts          # Environment configuration
│   ├── database/
│   │   ├── schema.sql         # Database structure
│   │   ├── reset.ts           # Database reset utility
│   │   ├── seed.ts            # Database seeding
│   │   └── sqlite.ts          # Repository pattern implementation
│   ├── models/
│   │   ├── User.ts            # User model
│   │   ├── Character.ts       # Character model
│   │   └── Message.ts         # Message model
│   ├── routes/
│   │   ├── auth.routes.ts     # Authentication endpoints
│   │   ├── character.routes.ts # Character CRUD
│   │   ├── chat.routes.ts     # Chat & SSE streaming
│   │   ├── image.routes.ts    # Image generation
│   │   └── user.routes.ts     # User profile
│   ├── services/
│   │   ├── ai.service.ts      # AI chat & streaming
│   │   └── image.service.ts   # Image generation
│   ├── tools/
│   │   └── tools.ts           # Agent tool definitions
│   └── types/
│       └── *.ts               # TypeScript interfaces
└── frontend/
    ├── app_*.js               # Page-specific logic
    ├── config.js              # Frontend configuration
    └── styles.css             # Cyberpunk theme

views/                         # HTML templates
storage/                       # Generated content (gitignored)
├── generated/                 # AI images
└── sandbox/                   # AI file operations
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

### **Required Environment Variables**

```env
# Server
PORT=3000
HOST=0.0.0.0

# AI Chat (OpenRouter)
API_URL=https://openrouter.ai/api/v1/chat/completions
API_KEY=your_openrouter_api_key
AI_DEFAULT_MODEL=x-ai/grok-4.1-fast

# Image Generation (Together AI)
TOGETHER_API_KEY=your_together_api_key
TOGETHER_IMAGE_MODEL=black-forest-labs/FLUX.2-dev

#XAI API Key (for Grok models)
XAI_API_KEY=your_xai_api_key_here
XAI_IMAGE_MODEL=grok-imagine-image


# Security
SESSION_SECRET=your_32_char_secret_key
```

### **Optional Settings**

```env
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

## ⚡ **Performance Benefits**

| Metric               | AI Character Chat | Traditional Solutions |
| -------------------- | ----------------- | --------------------- |
| **Startup Time**     | ~2 seconds        | 30+ seconds (Docker)  |
| **Memory Usage**     | ~100MB            | 2GB+ (Docker)         |
| **Disk Space**       | ~50MB             | 500MB+                |
| **Response Latency** | <500ms            | 1000ms+               |
| **Setup Complexity** | 3 commands        | Docker + config       |

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
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Test thoroughly**: `npm run test`
5. **Submit a pull request**

### **Development Guidelines**

- Follow existing code style
- Add TypeScript types for new features
- Update documentation
- Test with multiple AI models

---

## � **License**

MIT License - feel free to use this project for personal or commercial purposes.

---

## 🙏 **Acknowledgments**

- **Fastify Team** - Amazing HTTP framework
- **OpenRouter** - Unified AI API access
- **Together AI** - FLUX image generation
- **Alpine.js** - Lightweight reactivity
- **All Contributors** - Making AI accessible

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

</div>
