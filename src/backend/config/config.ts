import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

export const config = {
  storageDir: path.join(process.cwd(), 'storage'),
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  apiUrl: process.env.API_URL || 'https://openrouter.ai/api/v1/chat/completions',
  apiKey: process.env.API_KEY || '',

  aiDefaultModel: process.env.AI_DEFAULT_MODEL || 'qwen/qwen3.5-flash-02-23', //dont change this model
  aiEmbeddingModel: process.env.AI_EMBEDDING_MODEL || '',

  imageDefaultProvider: process.env.IMAGE_DEFAULT_PROVIDER || 'xai', // 'xai' | 'together'

  xaiApiKey: process.env.XAI_API_KEY || '',
  xaiImageApiUrl: process.env.XAI_IMAGE_API_URL || 'https://api.x.ai/v1/images/generations',
  xaiImageModel: process.env.XAI_IMAGE_MODEL || 'grok-imagine-image',

  togetherApiKey: process.env.TOGETHER_API_KEY || '',
  togetherApiUrl: process.env.TOGETHER_IMAGE_API_URL || 'https://api.together.xyz/v1/images/generations',
  togetherImageModel: process.env.TOGETHER_IMAGE_MODEL || 'black-forest-labs/FLUX.2-dev',

  aiTemperature: 0.7,
  aiTopP: 0.9,
  aiFrequencyPenalty: 0.5,
  aiPresencePenalty: 0.5,
  aiMaxTokens: 350,
  aiSafePrompt: false,
  aiProvider: {
    sort: 'throughput'
  },
  aiReasoning: {
    effort: 'none',
    exclude: true
  },
  jwtSecret: process.env.JWT_SECRET || 'a-very-long-and-secure-secret-key-that-is-at-least-32-characters-long',
  dbFile: path.join(process.cwd(), 'database.sqlite'),
  tempImagesDir: path.join(process.cwd(), 'storage', 'temp_images'),
  maxHistoryMessages: 30,
  aiStreaming: process.env.AI_STREAMING ? process.env.AI_STREAMING === 'true' : true,
  viewsRoot: path.join(process.cwd(), 'views'),
  frontendRoot: path.join(process.cwd(), 'src', 'frontend'),
  debugAi: process.env.AI_DEBUG_LOGS ? process.env.AI_DEBUG_LOGS === 'true' : false,
  debugRequests: process.env.DEBUG_REQUESTS ? process.env.DEBUG_REQUESTS === 'true' : false,
  nodeEnv: process.env.NODE_ENV || 'development',
  loggingDebug: process.env.LOGGING_DEBUG === 'true',
  avatarHeight: parseInt(process.env.AVATAR_HEIGHT || '800', 10),

  // Telegram fields
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramWebhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  telegramAdminUsers: process.env.TELEGRAM_ADMIN_USERS || '',
  telegramAllowedUsers: process.env.TELEGRAM_ALLOWED_USERS || '',
  telegramEnableImages: process.env.TELEGRAM_ENABLE_IMAGES === 'true',
  telegramEnableVoice: process.env.TELEGRAM_ENABLE_VOICE === 'true',
  telegramDefaultCharacterId: parseInt(process.env.TELEGRAM_DEFAULT_CHARACTER_ID || '1', 10),
  telegramRateLimitPerUser: parseInt(process.env.TELEGRAM_RATE_LIMIT_PER_USER || '30', 10),
  telegramRateLimitWindow: parseInt(process.env.TELEGRAM_RATE_LIMIT_WINDOW || '60', 10),
};

// Load dynamic config from config.json if it exists
const configJsonPath = path.join(process.cwd(), 'config.json');
if (fs.existsSync(configJsonPath)) {
  try {
    const raw = fs.readFileSync(configJsonPath, 'utf-8');
    if (raw.trim()) {
      const parsed = JSON.parse(raw);
      
      if (parsed.api_key !== undefined) config.apiKey = parsed.api_key;
      if (parsed.api_url !== undefined) config.apiUrl = parsed.api_url;
      if (parsed.ai_default_model !== undefined) config.aiDefaultModel = parsed.ai_default_model;
      
      if (parsed.together_api_key !== undefined) config.togetherApiKey = parsed.together_api_key;
      if (parsed.together_image_model !== undefined) config.togetherImageModel = parsed.together_image_model;
      if (parsed.xai_api_key !== undefined) config.xaiApiKey = parsed.xai_api_key;
      
      if (parsed.telegram_bot_token !== undefined) config.telegramBotToken = parsed.telegram_bot_token;
      if (parsed.telegram_webhook_url !== undefined) config.telegramWebhookUrl = parsed.telegram_webhook_url;
      if (parsed.telegram_webhook_secret !== undefined) config.telegramWebhookSecret = parsed.telegram_webhook_secret;
      if (parsed.telegram_admin_users !== undefined) config.telegramAdminUsers = parsed.telegram_admin_users;
      if (parsed.telegram_allowed_users !== undefined) config.telegramAllowedUsers = parsed.telegram_allowed_users;
      if (parsed.telegram_enable_images !== undefined) config.telegramEnableImages = parsed.telegram_enable_images === true || parsed.telegram_enable_images === 'true';
      if (parsed.telegram_enable_voice !== undefined) config.telegramEnableVoice = parsed.telegram_enable_voice === true || parsed.telegram_enable_voice === 'true';
      if (parsed.telegram_default_character_id !== undefined) config.telegramDefaultCharacterId = parseInt(parsed.telegram_default_character_id, 10);
      if (parsed.telegram_rate_limit_per_user !== undefined) config.telegramRateLimitPerUser = parseInt(parsed.telegram_rate_limit_per_user, 10);
      if (parsed.telegram_rate_limit_window !== undefined) config.telegramRateLimitWindow = parseInt(parsed.telegram_rate_limit_window, 10);
      
      if (parsed.port !== undefined) config.port = parseInt(parsed.port, 10);
      if (parsed.host !== undefined) config.host = parsed.host;
      if (parsed.jwt_secret !== undefined) config.jwtSecret = parsed.jwt_secret;
      if (parsed.logging_debug !== undefined) config.loggingDebug = parsed.logging_debug === true || parsed.logging_debug === 'true';
      if (parsed.debug_requests !== undefined) config.debugRequests = parsed.debug_requests === true || parsed.debug_requests === 'true';
      if (parsed.ai_debug_logs !== undefined) config.debugAi = parsed.ai_debug_logs === true || parsed.ai_debug_logs === 'true';
    }
  } catch (err) {
    console.error('Failed to parse config.json:', err);
  }
}

// MemoryService warning if embedding model is not configured
if (!config.aiEmbeddingModel) {
  console.warn('\n' + '='.repeat(50));
  console.warn('⚠️  [CONFIG WARNING] AI_EMBEDDING_MODEL is not set');
  console.warn('   MemoryService will not work without this configuration.');
  console.warn('   Please set AI_EMBEDDING_MODEL in your .env file.');
  console.warn('='.repeat(50) + '\n');
}

if (!config.apiKey) {
  console.warn('\n' + '='.repeat(50));
  console.warn('⚠️  [CONFIG WARNING] API_KEY is not set');
  console.warn('   Please configure it via settings UI (in your browser) or directly in your .env file.');
  console.warn('='.repeat(50) + '\n');
}

if (!config.apiUrl) {
  console.warn('\n' + '='.repeat(50));
  console.warn('⚠️  [CONFIG WARNING] API_URL is not set');
  console.warn('   Please configure it via settings UI (in your browser) or directly in your .env file.');
  console.warn('='.repeat(50) + '\n');
}


