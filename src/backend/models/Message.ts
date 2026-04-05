import { getDB } from '../database/sqlite';
import { ChatMessage } from '../types';

export class Message {
    static getHistory(characterId: number, userId: number): ChatMessage[] {
        const rows = getDB().prepare('SELECT id, role, content FROM messages WHERE character_id = ? AND user_id = ? ORDER BY timestamp ASC').all(characterId, userId) as any[];
        return rows;
    }

    static add(characterId: number, userId: number, message: ChatMessage, isGreeting: number = 0): void {
        const content = message.content;
        const stmt = getDB().prepare('INSERT INTO messages (character_id, user_id, role, content, is_greeting) VALUES (?, ?, ?, ?, ?)');
        stmt.run(characterId, userId, message.role, content, isGreeting);
    }

    static deleteHistory(characterId: number, userId: number): void {
        const stmt = getDB().prepare('DELETE FROM messages WHERE character_id = ? AND user_id = ?');
        stmt.run(characterId, userId);
    }

    static deleteBatch(ids: number[]): void {
        if (ids.length === 0) return;
        const stmt = getDB().prepare(`DELETE FROM messages WHERE id IN (${ids.join(',')})`);
        stmt.run();
    }

    static deleteAll(userId: number): void {
        const stmt = getDB().prepare('DELETE FROM messages WHERE user_id = ?');
        stmt.run(userId);
    }
}
