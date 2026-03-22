-- src/backend/database/schema.sql
-- Полный сброс и создание структуры базы данных

-- Отключаем проверку внешних ключей на время удаления
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS characters;
DROP TABLE IF EXISTS users;

PRAGMA foreign_keys = ON;

-- Таблица пользователей
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица персонажей
CREATE TABLE characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  system_prompt TEXT,
  first_message TEXT,
  scenario TEXT,
  temperature REAL DEFAULT 0.8,
  max_tokens INTEGER DEFAULT 250,
  avatar TEXT,
  avatar_prompt TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица сообщений
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

-- Индексы
CREATE INDEX idx_messages_char_id ON messages (character_id);
