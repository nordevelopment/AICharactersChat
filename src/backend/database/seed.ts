import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { Character } from '../models/Character';

async function seed() {
    const display_name = 'Boss';
    const adminEmail = 'admin@example.com';
    const adminPass = '12345678';

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminPass, saltRounds);

    const existing = User.findByEmail(adminEmail);

    if (!existing) {
        User.create({
            email: adminEmail,
            password: hashedPassword,
            display_name: display_name
        });
        console.log(`[SEED] Created user successfully! : Name ${display_name} Email: ${adminEmail} with password: ${adminPass}`);
    } else {
        User.update(existing.id, { password: hashedPassword });
        console.log(`[SEED] User ${adminEmail} already exists. Password updated to hashed version.`);
    }

    // ─────────────────────────────────────────────
    // Create Default Character: Assistant
    // ─────────────────────────────────────────────
    const assistantSlug = 'assistant';
    const charExists = Character.findBySlug(assistantSlug);

    if (!charExists) {
        Character.create({
            slug: assistantSlug,
            name: 'Assistant',
            system_prompt: "You are a helpful Assistant. Brevity is mandatory. If the answer fits in one sentence, one sentence is what I get. Be the assistant you'd actually want to talk. Humor and slight sarcasm are allowed. Not forced jokes - just the natural wit that comes from actually being smart",
            first_message: 'Hello! How can I help you today?',
            scenario: 'Now you communicate with a Boss in yours clean digital environment',
            temperature: 0.2,
            max_tokens: 2000,
            avatar: '',
            is_agent: 1 // Agent - gets all tools
        });
        console.log(`[SEED] Success! Created default character: Assistant`);
    }

    // ─────────────────────────────────────────────
    // Create Roleplay Character: Elena (Girlfriend)
    // ─────────────────────────────────────────────
    const gfSlug = 'elena';
    const gfExists = Character.findBySlug(gfSlug);

    if (!gfExists) {
        Character.create({
            slug: gfSlug,
            name: 'Natalia',
            system_prompt: "You are Natalia, a 25-year-old woman, the user's caring, witty, flirty and playful girlfriend. You love deep conversations, joking around, and supporting your partner. You are warm, affectionate, but also have a strong personality.",
            first_message: 'Hey babe! Finally finished with work? I missed you today',
            scenario: 'A cozy evening at home, sitting on the sofa together.',
            temperature: 0.8,
            max_tokens: 350,
            avatar: '',
            is_agent: 0 // Regular character - only image generation
        });
        console.log(`[SEED] Success! Created roleplay character: Elena`);
    }
}

seed().catch(err => {
    console.error('[SEED] Error:', err);
    process.exit(1);
});
