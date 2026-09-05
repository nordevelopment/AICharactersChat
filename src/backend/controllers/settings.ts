import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import { config } from '../config/config.js';
import { updateEnvFile } from '../utils/envHelper.js';
import { User } from '../models/User.js';
import { Character } from '../models/Character.js';
import { getDB } from '../database/sqlite.js';

export async function settingsRoutes(server: FastifyInstance) {
  
  const checkAuthOrUnconfigured = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!config.apiKey) {
      // Allow during first-launch setup
      return;
    }
    if (!request.session.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  };


  // Get system settings
  server.get('/api/settings', { preHandler: [checkAuthOrUnconfigured] }, async (_request, reply) => {
    return reply.send({
      hasApiKey: !!config.apiKey,
      apiKeyMasked: config.apiKey ? '******' : '',
      apiUrl: config.apiUrl || 'https://openrouter.ai/api/v1/chat/completions',
      aiDefaultModel: config.aiDefaultModel || '',
      
      hasTogetherApiKey: !!config.togetherApiKey,
      togetherApiKeyMasked: config.togetherApiKey ? '******' : '',
      togetherImageModel: config.togetherImageModel || 'black-forest-labs/FLUX.2-dev',
      
      hasXaiApiKey: !!config.xaiApiKey,
      xaiApiKeyMasked: config.xaiApiKey ? '******' : '',
      
      telegramBotTokenMasked: config.telegramBotToken ? '******' : '',
      hasTelegramBotToken: !!config.telegramBotToken,
      telegramWebhookUrl: config.telegramWebhookUrl || '',
      telegramWebhookSecretMasked: config.telegramWebhookSecret ? '******' : '',
      hasTelegramWebhookSecret: !!config.telegramWebhookSecret,
      telegramAdminUsers: config.telegramAdminUsers || '',
      telegramAllowedUsers: config.telegramAllowedUsers || '',
      telegramEnableImages: config.telegramEnableImages,
      telegramEnableVoice: config.telegramEnableVoice,
      telegramDefaultCharacterId: config.telegramDefaultCharacterId,
      telegramRateLimitPerUser: config.telegramRateLimitPerUser,
      telegramRateLimitWindow: config.telegramRateLimitWindow,

      port: config.port,
      host: config.host,
      jwtSecretMasked: config.jwtSecret ? '******' : '',
      hasJwtSecret: !!config.jwtSecret,
      loggingDebug: config.loggingDebug,
      debugRequests: config.debugRequests,
      debugAi: config.debugAi,
    });
  });

  // Save system settings
  server.post('/api/settings', { preHandler: [checkAuthOrUnconfigured] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    const envPath = path.join(process.cwd(), '.env');
    const configJsonPath = path.join(process.cwd(), 'config.json');

    const isNewKey = (key?: string) => key !== undefined && key !== '******';
    const getCleanValue = (key?: string) => {
      if (key === undefined) return undefined;
      const trimmed = key.trim();
      return trimmed === '-' ? '' : trimmed;
    };

    const updates: Record<string, any> = {};

    // Helper to extract values
    const processField = (fieldKey: string, payloadKey: string, isSecret = false, isBoolean = false, isNumber = false) => {
      if (body[payloadKey] !== undefined) {
        let value = body[payloadKey];
        if (isSecret) {
          if (isNewKey(value)) {
            value = getCleanValue(value);
            updates[fieldKey] = value;
          }
        } else if (isBoolean) {
          updates[fieldKey] = value === true || value === 'true';
        } else if (isNumber) {
          updates[fieldKey] = parseInt(value, 10);
        } else {
          updates[fieldKey] = String(value).trim();
        }
      }
    };

    processField('API_KEY', 'apiKey', true);
    processField('API_URL', 'apiUrl');
    processField('AI_DEFAULT_MODEL', 'aiDefaultModel');
    
    processField('TOGETHER_API_KEY', 'togetherApiKey', true);
    processField('TOGETHER_IMAGE_MODEL', 'togetherImageModel');
    processField('XAI_API_KEY', 'xaiApiKey', true);
    
    processField('TELEGRAM_BOT_TOKEN', 'telegramBotToken', true);
    processField('TELEGRAM_WEBHOOK_URL', 'telegramWebhookUrl');
    processField('TELEGRAM_WEBHOOK_SECRET', 'telegramWebhookSecret', true);
    processField('TELEGRAM_ADMIN_USERS', 'telegramAdminUsers');
    processField('TELEGRAM_ALLOWED_USERS', 'telegramAllowedUsers');
    processField('TELEGRAM_ENABLE_IMAGES', 'telegramEnableImages', false, true);
    processField('TELEGRAM_ENABLE_VOICE', 'telegramEnableVoice', false, true);
    processField('TELEGRAM_DEFAULT_CHARACTER_ID', 'telegramDefaultCharacterId', false, false, true);
    processField('TELEGRAM_RATE_LIMIT_PER_USER', 'telegramRateLimitPerUser', false, false, true);
    processField('TELEGRAM_RATE_LIMIT_WINDOW', 'telegramRateLimitWindow', false, false, true);

    processField('PORT', 'port', false, false, true);
    processField('HOST', 'host');
    processField('JWT_SECRET', 'jwtSecret', true);
    processField('LOGGING_DEBUG', 'loggingDebug', false, true);
    processField('DEBUG_REQUESTS', 'debugRequests', false, true);
    processField('AI_DEBUG_LOGS', 'debugAi', false, true);

    if (Object.keys(updates).length === 0) {
      return reply.send({ success: true, message: 'No changes to apply' });
    }

    // Apply updates to the in-memory config object
    if (updates.API_KEY !== undefined) config.apiKey = updates.API_KEY;
    if (updates.API_URL !== undefined) config.apiUrl = updates.API_URL;
    if (updates.AI_DEFAULT_MODEL !== undefined) config.aiDefaultModel = updates.AI_DEFAULT_MODEL;
    
    if (updates.TOGETHER_API_KEY !== undefined) config.togetherApiKey = updates.TOGETHER_API_KEY;
    if (updates.TOGETHER_IMAGE_MODEL !== undefined) config.togetherImageModel = updates.TOGETHER_IMAGE_MODEL;
    if (updates.XAI_API_KEY !== undefined) config.xaiApiKey = updates.XAI_API_KEY;
    
    if (updates.TELEGRAM_BOT_TOKEN !== undefined) config.telegramBotToken = updates.TELEGRAM_BOT_TOKEN;
    if (updates.TELEGRAM_WEBHOOK_URL !== undefined) config.telegramWebhookUrl = updates.TELEGRAM_WEBHOOK_URL;
    if (updates.TELEGRAM_WEBHOOK_SECRET !== undefined) config.telegramWebhookSecret = updates.TELEGRAM_WEBHOOK_SECRET;
    if (updates.TELEGRAM_ADMIN_USERS !== undefined) config.telegramAdminUsers = updates.TELEGRAM_ADMIN_USERS;
    if (updates.TELEGRAM_ALLOWED_USERS !== undefined) config.telegramAllowedUsers = updates.TELEGRAM_ALLOWED_USERS;
    if (updates.TELEGRAM_ENABLE_IMAGES !== undefined) config.telegramEnableImages = updates.TELEGRAM_ENABLE_IMAGES;
    if (updates.TELEGRAM_ENABLE_VOICE !== undefined) config.telegramEnableVoice = updates.TELEGRAM_ENABLE_VOICE;
    if (updates.telegramDefaultCharacterId !== undefined) config.telegramDefaultCharacterId = updates.TELEGRAM_DEFAULT_CHARACTER_ID;
    if (updates.telegramRateLimitPerUser !== undefined) config.telegramRateLimitPerUser = updates.TELEGRAM_RATE_LIMIT_PER_USER;
    if (updates.telegramRateLimitWindow !== undefined) config.telegramRateLimitWindow = updates.TELEGRAM_RATE_LIMIT_WINDOW;

    if (updates.PORT !== undefined) config.port = updates.PORT;
    if (updates.HOST !== undefined) config.host = updates.HOST;
    if (updates.JWT_SECRET !== undefined) config.jwtSecret = updates.JWT_SECRET;
    if (updates.LOGGING_DEBUG !== undefined) config.loggingDebug = updates.LOGGING_DEBUG;
    if (updates.DEBUG_REQUESTS !== undefined) config.debugRequests = updates.DEBUG_REQUESTS;
    if (updates.AI_DEBUG_LOGS !== undefined) config.debugAi = updates.AI_DEBUG_LOGS;

    try {
      if (fs.existsSync(envPath)) {
        // Mode 1: .env file exists. Save values to it, and ensure config.json is deleted
        const stringUpdates: Record<string, string> = {};
        for (const [k, v] of Object.entries(updates)) {
          stringUpdates[k] = String(v);
        }
        updateEnvFile(envPath, stringUpdates);

        if (fs.existsSync(configJsonPath)) {
          try {
            fs.unlinkSync(configJsonPath);
          } catch (e) {
            // ignore unlink error
          }
        }
      } else {
        // Mode 2: .env doesn't exist. Write to config.json
        let configJsonData: Record<string, any> = {};
        if (fs.existsSync(configJsonPath)) {
          try {
            const raw = fs.readFileSync(configJsonPath, 'utf-8');
            if (raw.trim()) {
              configJsonData = JSON.parse(raw);
            }
          } catch (e) {
            // ignore parse errors
          }
        }

        // Map updates to config.json structure (lowercase)
        const mappings: Record<string, string> = {
          API_KEY: 'api_key',
          API_URL: 'api_url',
          AI_DEFAULT_MODEL: 'ai_default_model',
          TOGETHER_API_KEY: 'together_api_key',
          TOGETHER_IMAGE_MODEL: 'together_image_model',
          XAI_API_KEY: 'xai_api_key',
          TELEGRAM_BOT_TOKEN: 'telegram_bot_token',
          TELEGRAM_WEBHOOK_URL: 'telegram_webhook_url',
          TELEGRAM_WEBHOOK_SECRET: 'telegram_webhook_secret',
          TELEGRAM_ADMIN_USERS: 'telegram_admin_users',
          TELEGRAM_ALLOWED_USERS: 'telegram_allowed_users',
          TELEGRAM_ENABLE_IMAGES: 'telegram_enable_images',
          TELEGRAM_ENABLE_VOICE: 'telegram_enable_voice',
          TELEGRAM_DEFAULT_CHARACTER_ID: 'telegram_default_character_id',
          TELEGRAM_RATE_LIMIT_PER_USER: 'telegram_rate_limit_per_user',
          TELEGRAM_RATE_LIMIT_WINDOW: 'telegram_rate_limit_window',
          PORT: 'port',
          HOST: 'host',
          JWT_SECRET: 'jwt_secret',
          LOGGING_DEBUG: 'logging_debug',
          DEBUG_REQUESTS: 'debug_requests',
          AI_DEBUG_LOGS: 'ai_debug_logs',
        };

        for (const [envKey, jsonKey] of Object.entries(mappings)) {
          if (updates[envKey] !== undefined) {
            configJsonData[jsonKey] = updates[envKey];
          }
        }

        fs.writeFileSync(configJsonPath, JSON.stringify(configJsonData, null, 2), 'utf-8');
      }

      return reply.send({ success: true, message: 'Settings saved successfully' });
    } catch (err) {
      server.log.error(err, 'Failed to save settings');
      return reply.code(500).send({ error: 'Failed to save settings: ' + (err instanceof Error ? err.message : String(err)) });
    }
  });

  // Initialize Database route
  server.post('/api/setup-db/initialize', async (_request, reply) => {
    try {
      const db = getDB();
      const schemaPath = path.join(process.cwd(), 'src/backend/database/schema.sql');
      if (!fs.existsSync(schemaPath)) {
        return reply.code(500).send({ error: 'Database schema file not found at ' + schemaPath });
      }
      
      const sql = fs.readFileSync(schemaPath, 'utf8');
      db.exec(sql);

      // Seed default admin user
      const display_name = 'Boss';
      const adminEmail = 'admin@example.com';
      const adminPass = '12345678';
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(adminPass, saltRounds);

      User.create({
        email: adminEmail,
        password: hashedPassword,
        display_name: display_name
      });

      // Seed default characters
      Character.create({
        slug: 'assistant',
        name: 'Assistant',
        system_prompt: "You are a helpful Assistant. Brevity is mandatory. If the answer fits in one sentence, one sentence is what I get. Be the assistant you'd actually want to talk. Humor and slight sarcasm are allowed. Not forced jokes - just the natural wit that comes from actually being smart",
        first_message: 'Hello! How can I help you today?',
        scenario: 'Now you communicate with a Boss in yours clean digital environment',
        temperature: 0.2,
        max_tokens: 2000,
        avatar: '',
        reasoning: 1,
        is_agent: 1
      });

      Character.create({
        slug: 'natalia',
        name: 'Natalia',
        system_prompt: "You are Natalia, a 25-year-old woman, the user's caring, witty, flirty and playful girlfriend. You love deep conversations, joking around, and supporting your partner. You are warm, affectionate, but also have a strong personality.",
        first_message: 'Hey babe! Finally finished with work? I missed you today',
        scenario: 'A cozy evening at home, sitting on the sofa together.',
        temperature: 0.8,
        max_tokens: 500,
        avatar: '',
        reasoning: 0,
        is_agent: 0
      });

      return reply.send({ 
        success: true, 
        message: 'Database initialized successfully', 
        user: { email: adminEmail, password: adminPass } 
      });
    } catch (err) {
      server.log.error(err, 'Failed to initialize database');
      return reply.code(500).send({ error: 'Failed to initialize database: ' + (err instanceof Error ? err.message : String(err)) });
    }
  });
}

