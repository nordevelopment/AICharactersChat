# AI Character Chat 🤖🎭

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-blue.svg)](https://www.fastify.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

**AI Character Chat** is a lightweight, self-hosted full-stack application designed for roleplaying with AI characters. It focuses on simplicity, speed, and a smooth user experience with real-time SSE streaming.

> **Why this?** Because sometimes you just want to chat with a character without setting up a 2GB docker image or navigating through 50 complex configuration menus. 

---

## 🛠 Tech Stack

### Backend:
- **Fastify** (Node.js + TypeScript) — High-performance, low-overhead framework.
- **SQLite** — Lightweight local database for chat history.
- **OpenRouter API** — The brain. Supports any model (Grok, Claude, GPT, etc.) with Server-Sent Events (SSE).
- **Pino** — Structured logging for easy debugging.

### Frontend:
- **Vanilla JavaScript / jQuery** — Keeping it simple and direct.
- **Bootstrap 5** — Clean and responsive UI.
- **Marked + Highlight.js** — Full Markdown support with code syntax highlighting.
- **DOMPurify** — Essential XSS protection.
- **Sharp** — High-performance image processing for AI input.

---

## ✨ Key Features

1.  **Unique Personalities**: Load character configurations from JSON files (`storage/characters/`). Easily add new ones.
2.  **Real-time Streaming**: No waiting for the full response. Text flows onto the screen as it's generated.
3.  **Smart Context Management (Summarization)**: When the chat history gets too long, the system automatically generates a concise summary to keep the AI in focus and save on tokens.
4.  **Markdown Support**: Full support for bold, italics, lists, and code blocks.
5.  **Image Uploads**: Process and send images to vision-enabled models with automatic resizing.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
PORT=3000
API_URL=https://openrouter.ai/api/v1/chat/completions
API_KEY=your_openrouter_api_key_here
```

### 3. Launch
```bash
# For development (with hot-reload)
npm run dev

# For production
npm run build
npm run start
```

### 4. Open in Browser
Visit `http://localhost:3000` and start your conversation.

---

## 📂 Project Structure

- `src/backend/` — Fastify server logic.
- `src/frontend/` — Client-side scripts and styles.
- `views/` — HTML templates.
- `storage/characters/` — JSON character definitions.
- `database.sqlite` — Local storage for chat logs.

---

*Built with a touch of sarcasm and faith in a digital future.*
