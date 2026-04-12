-- src/backend/database/schema.sql
-- Full reset and create database structure

-- Disable foreign key constraint checking during drop
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS characters;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS character_memories;
DROP TABLE IF EXISTS vec_character_memories;

PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Characters table
CREATE TABLE characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  system_prompt TEXT,
  first_message TEXT,
  scenario TEXT,
  temperature REAL DEFAULT 0.8,
  max_tokens INTEGER DEFAULT 500,
  avatar TEXT,
  is_agent INTEGER DEFAULT 0,
  reasoning INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  character_id INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  is_greeting INTEGER DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Memory facts table
CREATE TABLE character_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  character_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_messages_char_id ON messages (character_id);
CREATE INDEX idx_messages_user_id ON messages (user_id);
CREATE INDEX idx_memories_char_id ON character_memories (character_id);

