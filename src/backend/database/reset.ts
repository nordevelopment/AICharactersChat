import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import fs from 'fs';
import path from 'path';
import { config } from '../config/config';

function resetDatabase() {
    console.log('[DB] Starting database reset...');

    const db = new Database(config.dbFile);
    sqliteVec.load(db);

    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');

        // better-sqlite3 exec() выполняет несколько команд через точку с запятой
        db.exec(sql);

        console.log('✅ Database structure successfully reset and rebuilt from schema.sql');
        console.log('⚠️ DEAR USER: ALL PREVIOUS DATA IS DELETED. RUN "npm run db:seed" TO ADD TEST CHARACTERS AND USER.');
    } catch (err) {
        console.error('❌ Error rebuilding database:', err);
    } finally {
        db.close();
    }
}

resetDatabase();
