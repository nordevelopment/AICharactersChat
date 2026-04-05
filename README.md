# AI Character Chat 🤖🎭
> **The "Make it Easy" AI Roleplay Tool.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-blue.svg)](https://www.fastify.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

---
> "A solid move against the bloat. Repo looks clean—great stack for quick setups." — **Grok (xAI)**

### 🚀 Launch & Roleplay.
Most AI tools require a 2GB Docker image and 50 configuration menus. **AI Characters Chat** is different. It's built on a simple philosophy: **Keep it Easy.**

1. `npm install`
2. `npm run db:reset`
3. `npm run db:seed`
4. **Start Roleplaying.**
---

## 🔥 Features

- **Multi-User with Separate Histories**: Each user has their own isolated chat history. Your dark fantasy RP won't mix with your coding assistant chat.
- **Real-time Streaming (SSE)**: Text flows onto the screen as it's generated — no waiting for full responses.
- **Character Management**: Full CRUD UI at `/characters` — no JSON editing. Per-character temperature, max tokens, system prompt, scenario, and avatar.
- **AI Image Generation**: Generate images via FLUX model on Together AI. Supports 7 aspect ratios, steps, and guidance control.
- **Smart Context Summarization**: When chat history exceeds the limit, the AI automatically condenses it into a summary to stay focused while saving tokens.
- **Markdown + Code Highlighting**: Full support for bold, italics, lists, and code blocks via Marked + Highlight.js.
- **Image Uploads to Chat**: Send images to vision-capable models with auto-resizing via Sharp.
- **Profile Management**: Update display name and password from the nav menu.
- **Password Security**: Passwords hashed with bcrypt.
- **Tools (Agents)**: AI can create text files, read text files, and generate images.
---

## 🛠 Tech Stack

### Backend
| Package | Role |
|---|---|
| **Fastify 5** (TypeScript) | HTTP server — fast, low-overhead |
| **SQLite** (`sqlite` + `sqlite3`) | Local database, zero config |
| **@fastify/session** + **@fastify/cookie** | Session-based auth (PHP-style `$_SESSION`) |
| **@fastify/multipart** | File upload handling |
| **@fastify/static** | Static file serving |
| **axios** | HTTP client for AI API calls |
| **bcrypt** | Password hashing |
| **eventsource-parser** | SSE stream parsing from OpenRouter |
| **fastify-sse-v2** | SSE response to frontend |
| **sharp** | Image resize/compress before AI vision input |
| **pino / pino-pretty** | Structured logging |
| **tsx** | Run TypeScript directly, no compile step in dev |

### Frontend
| Library | Role |
|---|---|
| **Alpine.js 3** | Reactive UI without the bloat |
| **Bootstrap 5** | Layout and components |
| **Marked** | Markdown rendering |
| **Highlight.js** | Code syntax highlighting |
| **DOMPurify** | XSS protection |
| **Vanilla JS** | Application logic per page |

### AI Services
| Service | Role |
|---|---|
| **OpenRouter API** | Chat completions — supports Grok, Claude, GPT, Llama, etc. |
| **Together AI** | Image generation via FLUX.2-dev (or any compatible model) |

---

## ✨ Pages

| Route | Description |
|---|---|
| `/` | Login / Register |
| `/chat` | Main chat interface with SSE streaming |
| `/characters` | Character management dashboard |
| `/image-gen` | AI image generator |

---

## 🏗 Core Architecture

```
src/
├── backend/
│   ├── server.ts          # Entry point
│   ├── app.ts             # Fastify plugin registration
│   ├── config/
│   │   └── config.ts      # All env vars and defaults
│   ├── database/
│   │   ├── schema.sql     # Table definitions
│   │   ├── reset.ts       # Drops and recreates DB
│   │   ├── seed.ts        # DB seed script
│   │   └── sqlite.ts      # dbRepo — Repository Pattern
|   |   Models
│   │   ├── User.ts
│   │   ├── Character.ts
│   │   ├── Message.ts
│   ├── routes/
│   │   ├── auth.routes.ts      # Login, register, profile
│   │   ├── character.routes.ts # CRUD for characters
│   │   ├── chat.routes.ts      # SSE streaming endpoint
│   │   ├── image.routes.ts     # Image generation & history
|   |   |__ user.routes.ts      # User profile
│   ├── services/
│   │   ├── ai.service.ts       # OpenRouter SSE + summarization
│   │   └── image.service.ts    # Together AI image generation
│   └── types/
│       └── *.ts           # TypeScript interfaces
│   └── tools/
│       ├── tools.ts        # Tool definitions
└── frontend/
    ├── app_chat.js         # Chat page logic
    ├── app_characters.js   # Characters page logic
    ├── app_image_gen.js    # Image gen page logic
    ├── app_login.js        # Auth page logic
    ├── app_userprofile.js  # User profile logic
    ├── config.js           # Runtime config (prefix, etc.)
    ├── styles.css          # Global styles (cyberpunk theme)
    └── icons/              # UI icons

views/
├── chat.html
├── characters.html
├── image-gen.html
└── index.html

storage/
├── generated/             # Saved generated images (gitignored)
└── sandbox/               # AI-generated text files (gitignored)
```

---

## 🔑 Session Auth

Session-based auth — no JWT juggling:
- **Login** → `request.session.user` is set (like PHP's `$_SESSION`)
- **Cookie** → `session_id` managed server-side automatically
- **Guard** → `server.authenticate` decorator protects all private routes (returns 401 if no session)
- **Passwords** → Hashed with `bcrypt` (10 rounds)

---

## 🧠 AI Engine

### Chat (`ai.service.ts`)
- Streams from OpenRouter via SSE using `eventsource-parser`
- Builds context: `system_prompt` + `scenario` + history window
- Auto-summarizes when `messages.length > maxHistoryMessages` (default: 20)
- Injects summary as a system message to maintain continuity

### Image Gen (`image.service.ts`, Together AI)
- Sends prompt + aspect ratio → resolves to FLUX-optimized pixel dimensions (multiples of 32, ~1 MP)
- Downloads image from remote URL → saves to `storage/generated/`
- Serves via `/storage/generated/:file` static route
- Supports: steps, guidance scale, aspect ratio (7 presets), reference images

### Image Resize (Sharp)
- User-uploaded images for chat: resized to 1024×1024, 80% JPEG quality before sending to vision model

### Tools (Agents)
- AI can create text files, read text files, and generate images.
- Tool definitions in `src/backend/tools/definitions.ts`
- Tool handlers in `src/backend/tools/handlers.ts`
- **Sandbox**: All file operations are restricted to `storage/sandbox/` for security.
- **Toggle**: Tools can be enabled/disabled in `ENABLED_TOOLS_LIST` within `definitions.ts`.

---

## ⚙️ AI Parameter Tuning

#### 1. Per-Environment (`.env`)
- `AI_DEFAULT_MODEL` — fallback model slug
- `TOGETHER_IMAGE_MODEL` — image model slug (e.g. `black-forest-labs/FLUX.2-dev`)

#### 2. Per-App (`src/backend/config/config.ts`)
- `aiTemperature` (0.7) — global creativity default
- `maxHistoryMessages` (20) — summarization trigger
- `aiFrequencyPenalty` / `aiPresencePenalty` — repetition control

#### 3. Per-Character (UI / DB)
- `temperature` — individual creativity override
- `max_tokens` — response length cap
- `system_prompt` — personality definition
- `scenario` — current context/location

#### 4. Per-Tool (UI / DB)
- `enabled` — enable/disable tool

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Reset & Seed Database
```bash
npm run db:reset
npm run db:seed
```
> Creates tables, admin user, and example characters.

### 3. Configure Environment
Copy `.env.example` to `.env` and fill in your keys:
```env
PORT=3000
HOST=0.0.0.0

# Chat AI (OpenRouter)
API_URL=https://openrouter.ai/api/v1/chat/completions
API_KEY=your_openrouter_api_key_here
AI_DEFAULT_MODEL=x-ai/grok-2-1212

# Session
SESSION_SECRET=your_long_random_string_here_min_32_chars

# Image Generation (Together AI)
TOGETHER_API_KEY=your_together_api_key_here
TOGETHER_IMAGE_API_URL=https://api.together.xyz/v1/images/generations
TOGETHER_IMAGE_MODEL=black-forest-labs/FLUX.2-dev

# Debugging (Optional, defaults to true)
AI_DEBUG_LOGS=true
DEBUG_REQUESTS=true
```

### 4. Launch
```bash
# Development (hot-reload via tsx watch)
npm run dev

# Production
npm run build
npm run start
```

---

##  Database Schema
backend/database/schema.sql
---

*Built with a touch of sarcasm and faith in a digital future.*  
*Author: Norayr Petrosyan — [MIT License](LICENSE)*
