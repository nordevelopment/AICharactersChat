import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';
import path from 'path';

async function seed() {
    const DB_FILE = path.join(process.cwd(), 'database.sqlite');
    const db = new Database(DB_FILE);

    // Убедимся, что таблицы созданы (хотя server.ts тоже это делает)
    db.exec(`
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

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

    if (!existing) {
        db.prepare('INSERT INTO users (email, password, display_name) VALUES (?, ?, ?)').run(adminEmail, hashedPassword, 'SuperAdmin');
        console.log(`[SEED] Success! Default user created: ${adminEmail}`);
        console.log(`[SEED] Your password is still '${adminPass}', but it's now stored as a hash!`);
    } else {
        // Если пользователь уже есть, обновим его пароль на всякий случай (для рефакторинга)
        db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hashedPassword, adminEmail);
        console.log(`[SEED] User ${adminEmail} already exists. Password updated to hashed version.`);
    }

    db.close();
}

seed().catch(err => {
    console.error('[SEED] Error:', err);
    process.exit(1);
});
