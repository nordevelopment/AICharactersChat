import { getDB } from '../database/sqlite';
import { User as UserType } from '../types';

export class User {
    static findByEmail(email: string): UserType | undefined {
        return getDB().prepare('SELECT * FROM users WHERE email = ?').get(email) as UserType | undefined;
    }

    static findById(id: number): UserType | undefined {
        return getDB().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserType | undefined;
    }

    static update(id: number, data: Partial<UserType>): UserType | undefined {
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

        if (fields.length === 0) return this.findById(id);

        params.push(id);
        const stmt = getDB().prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...params);
        return this.findById(id);
    }
}
