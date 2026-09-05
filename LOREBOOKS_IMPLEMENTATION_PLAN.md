# Lorebooks (World Info) Implementation Plan for OpenRoleplayChat

This plan outlines the architecture, database schema, backend services, API endpoints, frontend views, and context integration for adding **Lorebooks (World Info)** support to OpenRoleplayChat (ORC).

---

## 1. Overview & Architecture

**Goal**: Allow users to create reusable Lorebooks containing world facts, background lore, and rules triggered by keywords or semantic relevance, and bind them to AI characters.

### Key Decisions
- **Stack Alignment**: Use existing Fastify 5 + TypeScript + SQLite (`better-sqlite3`) + Alpine.js 3 + Bootstrap 5 stack.
- **Triggering Mechanism**: 
  1. **Primary**: Fast Regex/Keyword matching against user input and recent conversation turns.
  2. **Secondary (Optional)**: Vector similarity search using existing `sqlite-vec` integration.
- **Interoperability**: Support importing/exporting standard SillyTavern / Chub.ai World Info JSON formats.

---

## 2. Database Schema Changes

File: `src/backend/database/schema.ts` (or migration file)

### A. New Tables

```sql
-- 1. Lorebooks Table
CREATE TABLE IF NOT EXISTS lorebooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Lorebook Entries Table
CREATE TABLE IF NOT EXISTS lorebook_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lorebook_id INTEGER NOT NULL,
  keys TEXT NOT NULL, -- JSON array of string keywords, e.g. '["eldoria", "kingdom"]'
  content TEXT NOT NULL,
  comment TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lorebook_id) REFERENCES lorebooks(id) ON DELETE CASCADE
);

-- 3. Character-Lorebook Junction Table
CREATE TABLE IF NOT EXISTS character_lorebooks (
  character_id INTEGER NOT NULL,
  lorebook_id INTEGER NOT NULL,
  PRIMARY KEY (character_id, lorebook_id),
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  FOREIGN KEY (lorebook_id) REFERENCES lorebooks(id) ON DELETE CASCADE
);
```

---

## 3. Backend Implementation

### A. Service Layer
File: `src/backend/services/lorebook.service.ts`

- `createLorebook(userId, data)`
- `updateLorebook(id, userId, data)`
- `deleteLorebook(id, userId)`
- `getUserLorebooks(userId)`
- `getLorebookWithEntries(id, userId)`
- `createEntry(lorebookId, data)`
- `updateEntry(entryId, data)`
- `deleteEntry(entryId)`
- `bindLorebooksToCharacter(characterId, lorebookIds[])`
- `getCharacterLorebooks(characterId)`
- `importSillyTavernLorebook(userId, jsonContent)`
- `exportLorebookToJSON(lorebookId)`

### B. Trigger Engine & Prompt Builder Integration
File: `src/backend/services/lorebook-matcher.service.ts`

```typescript
export function matchLorebookEntries(textWindow: string, entries: LorebookEntry[]): LorebookEntry[] {
  const matchedEntries: LorebookEntry[] = [];
  const normalizedText = textWindow.toLowerCase();

  for (const entry of entries) {
    if (!entry.is_active) continue;
    const keys: string[] = JSON.parse(entry.keys || "[]");
    
    // Check if any key matches as word/phrase in text
    const matched = keys.some(key => {
      const cleanKey = key.trim().toLowerCase();
      if (!cleanKey) return false;
      return normalizedText.includes(cleanKey);
    });

    if (matched) {
      matchedEntries.push(entry);
    }
  }

  return matchedEntries;
}
```

File: Update `src/backend/services/context.service.ts` (or `chat.service.ts`)
- Before calling OpenRouter API:
  1. Fetch active lorebooks bound to `character_id`.
  2. Collect all active entries from bound lorebooks.
  3. Run `matchLorebookEntries` against the user's latest prompt + last N chat messages.
  4. Append matched entries to system prompt block:
     ```text
     [World & Setting Info]
     - Entry Key: Content...
     ```

### C. API Routes & Controllers
File: `src/backend/routes/lorebook.routes.ts`

- `GET /api/lorebooks` - List user lorebooks
- `POST /api/lorebooks` - Create lorebook
- `GET /api/lorebooks/:id` - Get lorebook + entries
- `PUT /api/lorebooks/:id` - Update lorebook
- `DELETE /api/lorebooks/:id` - Delete lorebook
- `POST /api/lorebooks/:id/entries` - Create entry
- `PUT /api/lorebooks/entries/:entryId` - Update entry
- `DELETE /api/lorebooks/entries/:entryId` - Delete entry
- `POST /api/lorebooks/import` - Upload JSON/SillyTavern world info file
- `GET /api/lorebooks/:id/export` - Download JSON file

---

## 4. Frontend UI (Alpine.js + EJS + Bootstrap 5)

### A. Navigation & Views
1. **Navbar Update**: Add `Lorebooks` link to navigation bar.
2. **Lorebooks Page (`src/backend/views/lorebooks.ejs`)**:
   - List of user lorebooks (Cards with entry counts).
   - "Create Lorebook" modal.
   - "Import Lorebook" modal (file drag & drop for JSON).
3. **Lorebook Detail / Entry Manager**:
   - Add/edit/delete entries with multi-keyword input tag editor.
   - Toggle entry active status (`is_active`).

### B. Character Dashboard Update
File: `src/backend/views/characters.ejs`
- Add "Attached Lorebooks" section in character edit modal.
- Checkbox list or multi-select dropdown allowing binding 1 or more lorebooks to the character.

---

## 5. Telegram Integration Check

- Ensure `TELEGRAM` message handler invokes `context.service.ts` with lorebook matching enabled so character responses in Telegram seamlessly benefit from Lorebook knowledge.

---

## 6. Verification Plan

1. **Unit Tests**:
   - Test keyword matching logic (`lorebook-matcher.service.ts`) with exact match and partial match.
   - Test SillyTavern JSON parser import/export formatting.
2. **API Verification**:
   - Verify CRUD routes via Fastify test requests.
3. **End-to-End Chat Test**:
   - Create a Lorebook "Eldoria" with entry key `"sword of light"`.
   - Bind Lorebook to a Character.
   - Ask character: *"Where is the sword of light?"*
   - Verify in AI debug logs that `[World & Setting Info]` was injected into the prompt.
