import { getDB } from '../database/sqlite';
import { ChatMessage } from '../types';

export class Message {
    static getHistory(characterId: number, userId: number): ChatMessage[] {
        const rows = getDB().prepare('SELECT id, role, content FROM messages WHERE character_id = ? AND user_id = ? ORDER BY timestamp ASC').all(characterId, userId) as any[];
        return rows.map(row => ({
            id: row.id,
            role: row.role as any,
            content: row.content.startsWith('[') || row.content.startsWith('{') ? JSON.parse(row.content) : row.content
        }));
    }

    static add(characterId: number, userId: number, message: ChatMessage, isGreeting: number = 0): void {
        const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        const stmt = getDB().prepare('INSERT INTO messages (character_id, user_id, role, content, is_greeting) VALUES (?, ?, ?, ?, ?)');
        stmt.run(characterId, userId, message.role, content, isGreeting);
    }

    static deleteBatch(ids: number[]): void {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        const stmt = getDB().prepare(`DELETE FROM messages WHERE id IN (${placeholders})`);
        stmt.run(...ids);
    }

    static deleteHistory(characterId: number, userId: number): void {
        getDB().prepare('DELETE FROM messages WHERE character_id = ? AND user_id = ?').run(characterId, userId);
    }

    static deleteAll(userId: number): void {
        getDB().prepare('DELETE FROM messages WHERE user_id = ?').run(userId);
    }
}
