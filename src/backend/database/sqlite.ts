import Database from 'better-sqlite3';
import { config } from '../config/config';

let db: Database.Database;

/**
 * Initializes the SQLite database and sets up WAL mode for performance.
 */
export function initDB(): Database.Database {
  if (db) return db;

  db = new Database(config.dbFile);

  // WAL (Write-Ahead Logging) is crucial for concurrent performance in SQLite
  db.pragma('journal_mode = WAL');

  console.log('[DB] SQLite connected and ready.');
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

