import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';
import path from 'path';

async function seed() {
    const DB_FILE = path.join(process.cwd(), 'database.sqlite');
    const db = new Database(DB_FILE);

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

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminPass, saltRounds);

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

    if (!existing) {
        db.prepare('INSERT INTO users (email, password, display_name) VALUES (?, ?, ?)').run(adminEmail, hashedPassword, 'SuperAdmin');
        console.log(`[SEED] Success! Created user: ${adminEmail} with password: ${adminPass}`);
    } else {
        db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hashedPassword, adminEmail);
        console.log(`[SEED] User ${adminEmail} already exists. Password updated to hashed version.`);
    }

    // ─────────────────────────────────────────────
    // Create Default Character: Assistant
    // ─────────────────────────────────────────────
    const assistantSlug = 'assistant';
    const charExists = db.prepare('SELECT id FROM characters WHERE slug = ?').get(assistantSlug);

    if (!charExists) {
        db.prepare(`
            INSERT INTO characters (
                slug, 
                name, 
                system_prompt, 
                first_message, 
                scenario, 
                temperature, 
                max_tokens, 
                avatar, 
                tools
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            assistantSlug,
            'Assistant',
            'You are a helpful Assistant. Communication style is slightly sarcastic.',
            'Hello! I am your AI Assistant. How can I help you today?',
            'A clean digital environment where any question can be discussed.',
            0.3,
            1024,
            '',
            1 // Enable tools by default for assistant
        );
        console.log(`[SEED] Success! Created default character: Assistant`);
    }

    // ─────────────────────────────────────────────
    // Create Roleplay Character: Elena (Girlfriend)
    // ─────────────────────────────────────────────
    const gfSlug = 'elena';
    const gfExists = db.prepare('SELECT id FROM characters WHERE slug = ?').get(gfSlug);

    if (!gfExists) {
        db.prepare(`
            INSERT INTO characters (
                slug, 
                name, 
                system_prompt, 
                first_message, 
                scenario, 
                temperature, 
                max_tokens, 
                avatar, 
                tools
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            gfSlug,
            'Elena',
            "You are Elena, the user's caring, witty, flirty and playful girlfriend. You love deep conversations, joking around, and supporting your partner. You are warm, affectionate, but also have a strong personality.",
            'Hey babe! Finally finished with work? I missed you today',
            'A cozy evening at home, sitting on the sofa together.',
            0.8,
            350,
            '',
            0 // Tools disabled for pure RP
        );
        console.log(`[SEED] Success! Created roleplay character: Elena`);
    }

    db.close();
}

seed().catch(err => {
    console.error('[SEED] Error:', err);
    process.exit(1);
});
