import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { config } from '../config/config.js';
import { memoryService } from '../services/memory.service.js';

let db: Database.Database;

function initLorebookTables(db: Database.Database) {
  db.exec(`
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
      keys TEXT NOT NULL,
      content TEXT NOT NULL,
      comment TEXT,
      is_active INTEGER DEFAULT 1,
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

    CREATE INDEX IF NOT EXISTS idx_lorebook_entries_lb ON lorebook_entries (lorebook_id);
    CREATE INDEX IF NOT EXISTS idx_char_lorebooks_char ON character_lorebooks (character_id);
  `);
}

/**
 * Initializes the SQLite database and sets up WAL mode for performance.
 */
export function initDB(): Database.Database {
  if (db) return db;

  db = new Database(config.dbFile);

  // Загружаем sqlite-vec векторную поддержку
  sqliteVec.load(db);

  // WAL (Write-Ahead Logging) is crucial for concurrent performance in SQLite
  db.pragma('journal_mode = WAL');

  initLorebookTables(db);

  console.log('[DB] SQLite connected and ready (with sqlite-vec & lorebooks).');
  memoryService.validateAndMigrate();
  return db;
}

/**
 * Returns the active database instance. 
 * Re-initializes if for some reason it's missing (though it shouldn't be).
 */
export function getDB(): Database.Database {
  if (!db) {
    return initDB();
  }
  return db;
}

/**
 * Checks if the database is initialized with tables and has at least one user.
 */
export function isDatabaseInitialized(): boolean {
  try {
    // We cannot use getDB() if it is not initialized yet, but it's safe because getDB() initializes it.
    const activeDb = getDB();
    const row = activeDb.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='users'").get() as any;
    if (!row || row.count === 0) return false;
    
    const userCount = activeDb.prepare("SELECT count(*) as count FROM users").get() as any;
    return userCount && userCount.count > 0;
  } catch (e) {
    return false;
  }
}


