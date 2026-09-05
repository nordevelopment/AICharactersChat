import { getDB } from '../database/sqlite.js';

export interface LorebookType {
  id?: number;
  user_id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  entry_count?: number;
}

export interface LorebookEntryType {
  id?: number;
  lorebook_id: number;
  keys: string[]; // Handled as JSON string in DB
  content: string;
  comment?: string;
  is_active: number; // 1 or 0
  created_at?: string;
  updated_at?: string;
}

export interface LorebookWithEntries extends LorebookType {
  entries: LorebookEntryType[];
}

export class Lorebook {
  static allByUser(userId: number): LorebookType[] {
    const db = getDB();
    const rows = db.prepare(`
      SELECT l.*, COUNT(e.id) as entry_count 
      FROM lorebooks l 
      LEFT JOIN lorebook_entries e ON l.id = e.lorebook_id 
      WHERE l.user_id = ? 
      GROUP BY l.id 
      ORDER BY l.created_at DESC
    `).all(userId) as any[];
    return rows;
  }

  static findById(id: number, userId: number): LorebookWithEntries | undefined {
    const db = getDB();
    const lb = db.prepare('SELECT * FROM lorebooks WHERE id = ? AND user_id = ?').get(id, userId) as LorebookType | undefined;
    if (!lb || !lb.id) return undefined;

    const entries = this.getEntriesForLorebook(lb.id);
    return { ...lb, entries };
  }

  static create(userId: number, name: string, description?: string): LorebookType {
    const db = getDB();
    const stmt = db.prepare('INSERT INTO lorebooks (user_id, name, description) VALUES (?, ?, ?)');
    const res = stmt.run(userId, name, description || null);
    const newId = Number(res.lastInsertRowid);
    return db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(newId) as LorebookType;
  }

  static update(id: number, userId: number, name: string, description?: string): LorebookType | undefined {
    const db = getDB();
    const stmt = db.prepare(`
      UPDATE lorebooks 
      SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ?
    `);
    stmt.run(name, description || null, id, userId);
    return this.findById(id, userId);
  }

  static delete(id: number, userId: number): boolean {
    const db = getDB();
    const res = db.prepare('DELETE FROM lorebooks WHERE id = ? AND user_id = ?').run(id, userId);
    return res.changes > 0;
  }

  static getEntriesForLorebook(lorebookId: number): LorebookEntryType[] {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM lorebook_entries WHERE lorebook_id = ? ORDER BY id ASC').all(lorebookId) as any[];
    return rows.map(r => ({
      ...r,
      keys: typeof r.keys === 'string' ? JSON.parse(r.keys || '[]') : r.keys,
      is_active: r.is_active ?? 1
    }));
  }

  static createEntry(lorebookId: number, keys: string[], content: string, comment?: string, isActive = true): LorebookEntryType {
    const db = getDB();
    const keysJson = JSON.stringify(keys.map(k => k.trim()).filter(Boolean));
    const stmt = db.prepare(`
      INSERT INTO lorebook_entries (lorebook_id, keys, content, comment, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    const res = stmt.run(lorebookId, keysJson, content, comment || null, isActive ? 1 : 0);
    const newId = Number(res.lastInsertRowid);
    const row = db.prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(newId) as any;
    return {
      ...row,
      keys: JSON.parse(row.keys || '[]'),
      is_active: row.is_active
    };
  }

  static updateEntry(entryId: number, keys: string[], content: string, comment?: string, isActive = true): LorebookEntryType | undefined {
    const db = getDB();
    const keysJson = JSON.stringify(keys.map(k => k.trim()).filter(Boolean));
    const stmt = db.prepare(`
      UPDATE lorebook_entries 
      SET keys = ?, content = ?, comment = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(keysJson, content, comment || null, isActive ? 1 : 0, entryId);
    const row = db.prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(entryId) as any;
    if (!row) return undefined;
    return {
      ...row,
      keys: JSON.parse(row.keys || '[]'),
      is_active: row.is_active
    };
  }

  static deleteEntry(entryId: number): boolean {
    const db = getDB();
    const res = db.prepare('DELETE FROM lorebook_entries WHERE id = ?').run(entryId);
    return res.changes > 0;
  }

  static getEntriesForCharacter(characterId: number): LorebookEntryType[] {
    const db = getDB();
    const rows = db.prepare(`
      SELECT e.* 
      FROM lorebook_entries e
      JOIN character_lorebooks cl ON e.lorebook_id = cl.lorebook_id
      WHERE cl.character_id = ? AND e.is_active = 1
      ORDER BY e.id ASC
    `).all(characterId) as any[];

    return rows.map(r => ({
      ...r,
      keys: typeof r.keys === 'string' ? JSON.parse(r.keys || '[]') : r.keys,
      is_active: r.is_active
    }));
  }

  static bindToCharacter(characterId: number, lorebookIds: number[]): void {
    const db = getDB();
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM character_lorebooks WHERE character_id = ?').run(characterId);
      const stmt = db.prepare('INSERT INTO character_lorebooks (character_id, lorebook_id) VALUES (?, ?)');
      for (const lbId of lorebookIds) {
        stmt.run(characterId, lbId);
      }
    });
    transaction();
  }

  static getCharacterLorebookIds(characterId: number): number[] {
    const db = getDB();
    const rows = db.prepare('SELECT lorebook_id FROM character_lorebooks WHERE character_id = ?').all(characterId) as any[];
    return rows.map(r => r.lorebook_id);
  }

  /**
   * Imports standard SillyTavern / Chub World Info JSON structure into a new Lorebook.
   */
  static importSillyTavernJSON(userId: number, name: string, jsonContent: any): LorebookType {
    const db = getDB();
    const description = jsonContent.description || jsonContent.name || 'Imported Lorebook';
    const lbName = name || jsonContent.name || 'Imported Lorebook';

    const newLb = this.create(userId, lbName, description);

    // SillyTavern formats can store entries in `entries` object or array
    const entriesData = jsonContent.entries || jsonContent.data?.entries || {};
    const entriesArray = Array.isArray(entriesData) ? entriesData : Object.values(entriesData);

    const transaction = db.transaction(() => {
      for (const item of entriesArray) {
        if (!item) continue;
        let keysArr: string[] = [];
        if (Array.isArray(item.key)) {
          keysArr = item.key;
        } else if (typeof item.key === 'string') {
          keysArr = item.key.split(',').map((k: string) => k.trim()).filter(Boolean);
        } else if (Array.isArray(item.keys)) {
          keysArr = item.keys;
        }

        const content = item.content || item.entry || '';
        const comment = item.comment || item.name || item.title || null;
        const isActive = item.enabled !== undefined ? Boolean(item.enabled) : (item.is_active !== undefined ? Boolean(item.is_active) : true);

        if (keysArr.length > 0 && content.trim().length > 0) {
          this.createEntry(newLb.id!, keysArr, content, comment, isActive);
        }
      }
    });

    transaction();
    return newLb;
  }

  /**
   * Export Lorebook to SillyTavern-compatible JSON format.
   */
  static exportToJSON(lorebookId: number, userId: number): any {
    const lb = this.findById(lorebookId, userId);
    if (!lb) return null;

    const entriesObj: Record<string, any> = {};
    lb.entries.forEach((e, idx) => {
      entriesObj[String(idx)] = {
        uid: idx,
        key: e.keys,
        keysecondary: [],
        comment: e.comment || '',
        content: e.content,
        constant: false,
        selective: false,
        selectiveLogic: 0,
        addMemo: true,
        order: 100,
        position: 0,
        disable: !e.is_active,
        enabled: Boolean(e.is_active)
      };
    });

    return {
      name: lb.name,
      description: lb.description || '',
      scan_depth: 4,
      token_budget: 2048,
      recursive_scanning: false,
      entries: entriesObj
    };
  }
}
