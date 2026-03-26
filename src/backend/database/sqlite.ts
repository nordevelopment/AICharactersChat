import Database from 'better-sqlite3';
import { config } from '../config/config';
import { Character, ChatMessage, User } from '../types';

let db: Database.Database;

export function initDB() {
  db = new Database(config.dbFile);
  
  // Включаем WAL режим для производительности
  db.pragma('journal_mode = WAL');
  
  console.log('[DB] SQLite connected and ready.');
  return db;
}

export function getDB() {
  if (!db) throw new Error('[DB] Database not initialized');
  return db;
}

// Хелперы для работы с данными (Repo Pattern)
export const dbRepo = {
  getCharacters() {
    return db.prepare('SELECT * FROM characters ORDER BY created_at DESC').all() as Character[];
  },

  getCharacterBySlug(slug: string) {
    return db.prepare('SELECT * FROM characters WHERE slug = ?').get(slug) as Character;
  },

  getCharacterById(id: number) {
    return db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as Character;
  },

  createCharacter(char: Partial<Character>) {
    const { slug, name, system_prompt, first_message, scenario, temperature, max_tokens, avatar, tools } = char;
    const stmt = db.prepare(`
      INSERT INTO characters (slug, name, system_prompt, first_message, scenario, temperature, max_tokens, avatar, tools) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(slug, name, system_prompt || '', first_message || '', scenario || '', temperature || 0.7, max_tokens || 200, avatar || '', tools ? 1 : 0);
    return this.getCharacterBySlug(slug!);
  },

  updateCharacter(slug: string, char: Partial<Character>) {
    const { name, system_prompt, first_message, scenario, temperature, max_tokens, avatar, tools } = char;
    const stmt = db.prepare(`
      UPDATE characters SET name=?, system_prompt=?, first_message=?, scenario=?, temperature=?, max_tokens=?, avatar=?, tools=? WHERE slug=?
    `);
    stmt.run(name, system_prompt, first_message, scenario, temperature, max_tokens, avatar, tools ? 1 : 0, slug);
    return this.getCharacterBySlug(slug);
  },

  deleteCharacter(slug: string) {
    const char = this.getCharacterBySlug(slug);
    if (char) {
      db.prepare('DELETE FROM characters WHERE id = ?').run(char.id);
    }
  },

  getChatMessages(characterId: number, userId: number): ChatMessage[] {
    const rows = db.prepare('SELECT id, role, content FROM messages WHERE character_id = ? AND user_id = ? ORDER BY timestamp ASC').all(characterId, userId) as any[];
    return rows.map(row => ({
      id: row.id,
      role: row.role as any,
      content: row.content.startsWith('[') || row.content.startsWith('{') ? JSON.parse(row.content) : row.content
    }));
  },

  addMessage(characterId: number, userId: number, message: ChatMessage, isGreeting: number = 0) {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    const stmt = db.prepare('INSERT INTO messages (character_id, user_id, role, content, is_greeting) VALUES (?, ?, ?, ?, ?)');
    stmt.run(characterId, userId, message.role, content, isGreeting);
  },

  deleteMessages(ids: number[]) {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`);
    stmt.run(...ids);
  },

  deleteHistory(characterId: number, userId: number) {
    db.prepare('DELETE FROM messages WHERE character_id = ? AND user_id = ?').run(characterId, userId);
  },

  deleteAllHistory(userId: number) {
    db.prepare('DELETE FROM messages WHERE user_id = ?').run(userId);
  },

  getUserByEmail(email: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  },

  getUserById(id: number): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },

  updateUser(id: number, data: Partial<User>) {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.display_name !== undefined) {
      fields.push('display_name = ?');
      params.push(data.display_name);
    }

    if (data.password !== undefined) {
      fields.push('password = ?');
      params.push(data.password);
    }

    if (fields.length === 0) return;

    params.push(id);
    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...params);
    return this.getUserById(id);
  }
};
