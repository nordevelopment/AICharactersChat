import { getDB } from '../database/sqlite';
import { ChatMessage } from '../types';

export class Message {
    static getHistory(characterId: number, userId: number): ChatMessage[] {
        const rows = getDB().prepare('SELECT id, role, content FROM messages WHERE character_id = ? AND user_id = ? ORDER BY timestamp ASC').all(characterId, userId) as any[];

        return rows.map(r => {
            try {
                const parsed = JSON.parse(r.content);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    if (parsed.tool_calls || parsed.tool_call_id || parsed.name) {
                        // Возвращаем все поля как есть, включая tool_calls, tool_call_id, name
                        return { ...r, ...parsed };
                    }
                }
                r.content = parsed;
            } catch (e) {

            }
            
            return r;
        });
    }

    static add(characterId: number, userId: number, message: ChatMessage, isGreeting: number = 0): void {
        const hasMeta = !!(message.tool_calls || message.tool_call_id || message.name);
        let contentToSave: any;

        if (hasMeta) {
            contentToSave = JSON.stringify({
                content: message.content,
                tool_calls: message.tool_calls,
                tool_call_id: message.tool_call_id,
                name: message.name
            });
        } else {
            contentToSave = typeof message.content === 'object' ? JSON.stringify(message.content) : message.content;
        }

        const stmt = getDB().prepare('INSERT INTO messages (character_id, user_id, role, content, is_greeting) VALUES (?, ?, ?, ?, ?)');
        stmt.run(characterId, userId, message.role, contentToSave, isGreeting);
    }

    static deleteHistory(characterId: number, userId: number): void {
        const stmt = getDB().prepare('DELETE FROM messages WHERE character_id = ? AND user_id = ?');
        stmt.run(characterId, userId);
    }

    static deleteBatch(ids: number[]): void {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        const stmt = getDB().prepare(`DELETE FROM messages WHERE id IN (${placeholders})`);
        stmt.run(...ids);
    }

    static deleteAll(userId: number): void {
        const stmt = getDB().prepare('DELETE FROM messages WHERE user_id = ?');
        stmt.run(userId);
    }
}
