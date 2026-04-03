import { getDB } from '../database/sqlite';
import { Character as CharacterType } from '../types';

export class Character {
    static all(): CharacterType[] {
        return getDB().prepare('SELECT * FROM characters ORDER BY created_at DESC').all() as CharacterType[];
    }

    static findBySlug(slug: string): CharacterType | undefined {
        return getDB().prepare('SELECT * FROM characters WHERE slug = ?').get(slug) as CharacterType | undefined;
    }

    static findById(id: number): CharacterType | undefined {
        return getDB().prepare('SELECT * FROM characters WHERE id = ?').get(id) as CharacterType | undefined;
    }

    static create(char: Partial<CharacterType>): CharacterType {
        const { slug, name, system_prompt, first_message, scenario, temperature, max_tokens, avatar, tools, reasoning } = char;
        const stmt = getDB().prepare(`
            INSERT INTO characters (slug, name, system_prompt, first_message, scenario, temperature, max_tokens, avatar, tools, reasoning) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(slug, name, system_prompt || '', first_message || '', scenario || '', temperature || 0.7, max_tokens || 200, avatar || '', tools ? 1 : 0, reasoning ? 1 : 0);
        return this.findBySlug(slug!)!;
    }

    static update(slug: string, char: Partial<CharacterType>): CharacterType | undefined {
        const { name, system_prompt, first_message, scenario, temperature, max_tokens, avatar, tools, reasoning } = char;
        const stmt = getDB().prepare(`
            UPDATE characters SET name=?, system_prompt=?, first_message=?, scenario=?, temperature=?, max_tokens=?, avatar=?, tools=?, reasoning=? WHERE slug=?
        `);
        stmt.run(name, system_prompt, first_message, scenario, temperature, max_tokens, avatar, tools ? 1 : 0, reasoning ? 1 : 0, slug);
        return this.findBySlug(slug);
    }

    static delete(slug: string): void {
        const char = this.findBySlug(slug);
        if (char) {
            getDB().prepare('DELETE FROM characters WHERE id = ?').run(char.id);
        }
    }
}
