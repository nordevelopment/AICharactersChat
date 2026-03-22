import bcrypt from 'bcrypt';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';

async function seed() {
    const DB_FILE = path.join(process.cwd(), 'database.sqlite');
    const db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });

    // Убедимся, что таблицы созданы (хотя server.ts тоже это делает)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            display_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const adminEmail = 'admin@example.com';
    const adminPass = '12345678';

    // Хешируем пароль БЕЗОПАСНО
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminPass, saltRounds);

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [adminEmail]);

    if (!existing) {
        await db.run(
            'INSERT INTO users (email, password, display_name) VALUES (?, ?, ?)',
            [adminEmail, hashedPassword, 'SuperAdmin']
        );
        console.log(`[SEED] Success! Default user created: ${adminEmail}`);
        console.log(`[SEED] Your password is still '${adminPass}', but it's now stored as a hash!`);
    } else {
        // Если пользователь уже есть, обновим его пароль на всякий случай (для рефакторинга)
        await db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, adminEmail]);
        console.log(`[SEED] User ${adminEmail} already exists. Password updated to hashed version.`);
    }

    await db.close();
}

seed().catch(err => {
    console.error('[SEED] Error:', err);
    process.exit(1);
});
