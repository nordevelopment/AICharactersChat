import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config/config';

async function resetDatabase() {
    console.log('[DB] Starting database reset...');

    const db = await open({
        filename: config.dbFile,
        driver: sqlite3.Database
    });

    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');

        // Нативный exec() в sqlite3 умеет выполнять несколько команд через точку с запятой
        await db.exec(sql);

        console.log('✅ Database structure successfully reset and rebuilt from schema.sql');
        console.log('⚠️ DEAR USER: ALL PREVIOUS DATA IS NOW GONE. RUN "npm run seed" IF YOU WANT TEST CHARACTERS.');
    } catch (err) {
        console.error('❌ Error rebuilding database:', err);
    } finally {
        await db.close();
    }
}

resetDatabase();
