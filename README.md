# AI Character Chat 🤖🎭

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-blue.svg)](https://www.fastify.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

> "A solid move against the bloat. Repo looks clean—great stack for quick setups." — **Grok (xAI)** 🚀

---

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

1.  **Character Management UI**: Create, edit, and delete characters directly from a dedicated management dashboard (`/characters`). No manual JSON editing required.
2.  **Real-time Streaming**: No waiting for the full response. Text flows onto the screen as it's generated (SSE).
3.  **Smart Context Management (Summarization)**: When the chat history gets too long, the system automatically generates a concise summary to keep the AI in focus and save on tokens.
4.  **Markdown Support**: Full support for bold, italics, lists, and code blocks.
5.  **Image Uploads**: Process and send images to vision-enabled models with automatic resizing via `sharp`.

---

## 🏗 Core Architecture

The project is structured into clear layers to maintain high code quality and prevent "spaghetti" logic:

- **`config/`**: Constants and settings derived from `.env`.
- **`database/`**: SQLite interaction using the **Repository Pattern**.
- **`routes/`**: API endpoints and controller logic.
- **`services/`**: Core business logic (AI interactions, image processing).
- **`types/`**: TypeScript interfaces and contracts.

### 🔑 Session Management (Like Laravel/PHP)
We use traditional sessions instead of JWT for a simpler, more familiar workflow:
1.  **Libraries**: Powered by `@fastify/cookie` and `@fastify/session`.
2.  **Login**: User data is stored in `request.session.user`, behaving exactly like `$_SESSION` in PHP.
3.  **Cookies**: The server handles the `session_id` cookie automatically. No need to manually manage tokens in headers.
4.  **Auth Middleware**: The `server.authenticate` decorator checks for valid sessions, returning 401 if unauthorized.

### � Data Layer (Repository Pattern)
Drawing inspiration from Laravel's Eloquent, we use `dbRepo`:
- Instead of raw queries, use clean methods like `await dbRepo.getUserByEmail(email)`.
- This ensures the database logic is decoupled from the routes, making it easy to test or switch engines.

---

## 🧠 AI Engine & Parameter Tuning

The "brains" of the system reside in the `ai.service.ts`. It handles streaming, image compression (1024x1024, 80% quality), and context summarization.

### Advanced Configuration
You can fine-tune the AI's behavior at three different levels:

#### 1. Global Environment (`.env`)
- **`API_URL`**: Your AI provider endpoint (OpenRouter, OpenAI, etc.).
- **`AI_DEFAULT_MODEL`**: The fallback model (e.g., `x-ai/grok-2-1212`).
- **`SESSION_SECRET`**: Secure key for session encryption.

#### 2. System Logic (`src/backend/config/config.ts`)
Hardcoded defaults for the application:
- **`aiTemperature`** (0.7): Creativity level.
- **`maxHistoryMessages`** (20): Number of messages kept in active memory before summarization triggers.
- **`aiFrequencyPenalty` / `aiPresencePenalty`**: Controls repetition.

#### 3. Character Tuning (Database / UI)
Each character can override global settings:
- **`temperature`**: Individual "quirkiness" levels.
- **`system_prompt`**: The most critical part — defines the character's personality and rules.
- **`scenario`**: Defines the current location or event context.

---

## �🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Initial Setup
Create the admin user and initial characters with the seeding script:
```bash
npm run seed
```

### 3. Configure Environment
Create a `.env` file in the root directory (use `.env.example` as a template):
```env
PORT=3000
API_URL=https://openrouter.ai/api/v1/chat/completions
API_KEY=your_openrouter_api_key_here
SESSION_SECRET=your_long_random_string_here
```

### 4. Launch
```bash
# Development (with hot-reload)
npm run dev

# Production
npm run build
npm run start
```

---

## 📂 Project Structure

- `src/backend/` — Fastify server logic.
- `src/frontend/` — Client-side scripts and styles.
- `views/` — HTML templates.
- `database.sqlite` — Local storage for chat logs and character definitions.
- `storage/temp_images/` — Temporary storage for image uploads.

---

*Built with a touch of sarcasm and faith in a digital future.*

