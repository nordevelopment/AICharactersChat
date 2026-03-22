import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import { config } from '../config/config';
import { Character, ChatMessage, User } from '../types';

let db: Database;

export async function initDB() {
  db = await open({
    filename: config.dbFile,
    driver: sqlite3.Database
  });

  console.log('[DB] SQLite connected and ready.');
  return db;
}

export function getDB() {
  if (!db) throw new Error('[DB] Database not initialized');
  return db;
}

// Хелперы для работы с данными (Repo Pattern)
export const dbRepo = {
  async getCharacters() {
    return await db.all<Character[]>('SELECT * FROM characters ORDER BY created_at DESC');
  },

  async getCharacterBySlug(slug: string) {
    return await db.get<Character>('SELECT * FROM characters WHERE slug = ?', [slug]);
  },

  async getCharacterById(id: number) {
    return await db.get<Character>('SELECT * FROM characters WHERE id = ?', [id]);
  },

  async createCharacter(char: Partial<Character>) {
    const { slug, name, system_prompt, first_message, scenario, temperature, max_tokens, avatar, avatar_prompt } = char;
    await db.run(
      `INSERT INTO characters (slug, name, system_prompt, first_message, scenario, temperature, max_tokens, avatar, avatar_prompt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, name, system_prompt || '', first_message || '', scenario || '', temperature || 0.7, max_tokens || 200, avatar || '', avatar_prompt || '']
    );
    return await this.getCharacterBySlug(slug!);
  },

  async updateCharacter(slug: string, char: Partial<Character>) {
    const { name, system_prompt, first_message, scenario, temperature, max_tokens, avatar, avatar_prompt } = char;
    await db.run(
      `UPDATE characters SET name=?, system_prompt=?, first_message=?, scenario=?, temperature=?, max_tokens=?, avatar=?, avatar_prompt=? WHERE slug=?`,
      [name, system_prompt, first_message, scenario, temperature, max_tokens, avatar, avatar_prompt, slug]
    );
    return await this.getCharacterBySlug(slug);
  },

  async deleteCharacter(slug: string) {
    const char = await this.getCharacterBySlug(slug);
    if (char) {
      await db.run('DELETE FROM characters WHERE id = ?', [char.id]);
    }
  },

  async getChatMessages(characterId: number, userId: number): Promise<ChatMessage[]> {
    const rows = await db.all('SELECT id, role, content FROM messages WHERE character_id = ? AND user_id = ? ORDER BY timestamp ASC', [characterId, userId]);
    return rows.map(row => ({
      id: row.id,
      role: row.role as any,
      content: row.content.startsWith('[') || row.content.startsWith('{') ? JSON.parse(row.content) : row.content
    }));
  },

  async addMessage(characterId: number, userId: number, message: ChatMessage, isGreeting: number = 0) {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    await db.run(
      'INSERT INTO messages (character_id, user_id, role, content, is_greeting) VALUES (?, ?, ?, ?, ?)',
      [characterId, userId, message.role, content, isGreeting]
    );
  },

  async deleteMessages(ids: number[]) {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await db.run(`DELETE FROM messages WHERE id IN (${placeholders})`, ids);
  },

  async deleteHistory(characterId: number, userId: number) {
    await db.run('DELETE FROM messages WHERE character_id = ? AND user_id = ?', [characterId, userId]);
  },

  async deleteAllHistory(userId: number) {
    await db.run('DELETE FROM messages WHERE user_id = ?', [userId]);
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    return await db.get<User>('SELECT * FROM users WHERE email = ?', [email]);
  }
};
