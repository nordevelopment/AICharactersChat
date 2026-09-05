# Open Roleplay Chat (ORC) - Technical Documentation 🛠️🧠

This document is intended for developers, system administrators, and advanced users who want to understand the inner workings, configure advanced settings, or contribute to ORC.

---

## 🏗️ Technical Architecture

### Backend Stack
- **Runtime**: Node.js v20+
- **Framework**: Fastify v5 (TypeScript)
- **Database**: SQLite + `sqlite-vec` (v0.1.x) for vector embeddings and long-term memory
- **Image Manipulation**: `sharp` for fast avatar resizing and image optimization
- **Authentication**: Session-based cookie auth with `@fastify/session` and `bcrypt` hashing

### Frontend Stack
- **Engine**: Alpine.js v3 (lightweight reactivity framework under 10KB)
- **CSS Framework**: Custom styling based on Bootstrap 5 utility system + Cybercore UI variables
- **Text Rendering**: `marked` + `highlight.js` for markdown and code formatting
- **Security**: `DOMPurify` for XSS protection in rendered messages

### AI & Media Integration
- **LLM API**: OpenRouter API (OpenAI compatible)
- **Image Generation**: Together AI (FLUX models) or X.AI API

---

## ⚙️ Advanced Configuration Variables

All server-side configuration is merged from `.env` and `config.json` at startup.

### General & Performance
- `PORT`: Server port (default: `3000`).
- `HOST`: Server host binding (default: `127.0.0.1`).
- `NODE_ENV`: Set to `production` or `development`.
- `JWT_SECRET`: Secure session key (minimum 32 characters recommended).

### Logging & Diagnostics
- `LOGGING_DEBUG`: Enables verbose Fastify request logging (`true`/`false`).
- `DEBUG_REQUESTS`: Logs request payloads (`true`/`false`).
- `AI_DEBUG_LOGS`: Logs detailed prompt payloads sent to OpenRouter (`true`/`false`).

### AI Configuration (OpenRouter)
- `API_KEY`: Your OpenRouter api token.
- `API_URL`: Direct endpoint (default: `https://openrouter.ai/api/v1/chat/completions`).
- `AI_DEFAULT_MODEL`: LLM identifier (default: `qwen/qwen3.5-flash-02-23`).
- `AI_EMBEDDING_MODEL`: Embeddings provider for long-term memory (e.g., `qwen/qwen3-embedding-8b`).

### Image Generation APIs
- `TOGETHER_API_KEY`: API token for Together.xyz.
- `TOGETHER_IMAGE_API_URL`: Generation endpoint (default: `https://api.together.xyz/v1/images/generations`).
- `TOGETHER_IMAGE_MODEL`: Model signature (default: `black-forest-labs/FLUX.2-dev`).
- `XAI_API_KEY`: Alternative API token for X.AI generation.

### Telegram Bot Integration (Optional)
- `TELEGRAM_BOT_TOKEN`: Token obtained from `@BotFather`.
- `TELEGRAM_WEBHOOK_URL`: Absolute public HTTPS route mapping (`https://your-domain.com/webhook/telegram`).
- `TELEGRAM_WEBHOOK_SECRET`: Salt check string for webhooks.
- `TELEGRAM_ALLOWED_USERS`: CSV list of Telegram numeric User IDs allowed to chat.
- `TELEGRAM_ADMIN_USERS`: CSV list of Telegram User IDs allowed to execute bot admin actions.
- `TELEGRAM_ENABLE_IMAGES`: Allow vision upload in TG (`true`/`false`).
- `TELEGRAM_ENABLE_VOICE`: Allow voice interaction (`true`/`false`).
- `TELEGRAM_DEFAULT_CHARACTER_ID`: Initial character assigned to new chat states.
- `TELEGRAM_RATE_LIMIT_PER_USER`: Max queries per window.
- `TELEGRAM_RATE_LIMIT_WINDOW`: Time window size in seconds.

---

## 🗄️ Database Schema & Structure

ORC stores data inside `database.sqlite` (zero-configuration).

```sql
-- Core users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOCTINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    about TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI Character configurations
CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    system_prompt TEXT,
    first_message TEXT,
    scenario TEXT,
    avatar TEXT,
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,
    reasoning INTEGER DEFAULT 0,
    is_agent INTEGER DEFAULT 0
);

-- Long-term text memories (RAG)
CREATE TABLE IF NOT EXISTS character_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    character_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vector table (powered by sqlite-vec vec0 extension)
CREATE VIRTUAL TABLE vec_character_memories USING vec0(
    embedding float[1536] -- Dimensionality is auto-migrated based on configured model
);

-- Lorebooks & World Info
CREATE TABLE IF NOT EXISTS lorebooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lorebook_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lorebook_id INTEGER NOT NULL,
    keys TEXT NOT NULL, -- Comma-separated trigger keywords
    content TEXT NOT NULL,
    comment TEXT,
    is_enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lorebook_id) REFERENCES lorebooks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS character_lorebooks (
    character_id INTEGER NOT NULL,
    lorebook_id INTEGER NOT NULL,
    PRIMARY KEY (character_id, lorebook_id),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (lorebook_id) REFERENCES lorebooks(id) ON DELETE CASCADE
);
```

### 📚 Lorebooks & World Info Architecture
- **Keyword Triggering**: Scans recent user/assistant messages for comma-separated trigger keywords (`keys`).
- **Context Injection**: Active entries are injected dynamically into the system prompt window sorted by priority.
- **Interoperability**: Compatible with SillyTavern and Chub.ai JSON World Info schemas for 1-click import and export.

---

## 🛠️ CLI Operations & Commands

### Installing Dependencies
```bash
npm install
```

### Database Reset & Seeds
Resetting will wipe existing SQLite structures:
```bash
npm run db:reset    # Execute schema.sql to construct clean tables
npm run db:seed     # Seeds default Natalia & Assistant configurations
```

### Running Server
```bash
# Hot-reload developer monitoring
npm run dev

# Compile and start node application
npm run build
npm run start
```

---

## 📱 Telegram Integration & Setup

For full details on webhooks, secure certificates, and setting up private bot loops, please read **[TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)**.
