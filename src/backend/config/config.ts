import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  apiUrl: process.env.API_URL || '',
  apiKey: process.env.API_KEY || '',
  aiDefaultModel: process.env.AI_DEFAULT_MODEL || 'x-ai/grok-4.1-fast', //dont change this model

  xaiApiKey: process.env.XAI_API_KEY || '',
  xaiImageApiUrl: process.env.XAI_IMAGE_API_URL || 'https://api.x.ai/v1/images/generations',
  xaiImageModel: process.env.XAI_IMAGE_MODEL || 'grok-imagine-image',
  
  aiTemperature: 0.7,
  aiTopP: 0.9,
  aiFrequencyPenalty: 0.5,
  aiPresencePenalty: 0.5,
  aiMaxTokens: 250,
  aiSafePrompt: false,
  aiProvider: {
    sort: 'throughput'
  },
  aiReasoning: {
    effort: 'none',
    exclude: true
  },
  jwtSecret: process.env.JWT_SECRET || 'a-very-long-and-secure-secret-key-that-is-at-least-32-characters-long',
  togetherApiKey: process.env.TOGETHER_API_KEY || '',
  togetherApiUrl: process.env.TOGETHER_IMAGE_API_URL || 'https://api.together.xyz/v1/images/generations',
  togetherImageModel: process.env.TOGETHER_IMAGE_MODEL || 'black-forest-labs/FLUX.2-dev',
  dbFile: path.join(process.cwd(), 'database.sqlite'),
  tempImagesDir: path.join(process.cwd(), 'storage', 'temp_images'),
  maxHistoryMessages: 20,
  aiStreaming: process.env.AI_STREAMING ? process.env.AI_STREAMING === 'true' : true,
  viewsRoot: path.join(process.cwd(), 'views'),
  frontendRoot: path.join(process.cwd(), 'src', 'frontend'),
  debugAi: process.env.AI_DEBUG_LOGS ? process.env.AI_DEBUG_LOGS === 'true' : true,
  debugRequests: process.env.DEBUG_REQUESTS ? process.env.DEBUG_REQUESTS === 'true' : false,
  avatarHeight: parseInt(process.env.AVATAR_HEIGHT || '800', 10),
};

// Простая проверка обязательных переменных
if (!config.apiUrl || !config.apiKey) {
  console.warn('[CONFIG] WARNING: API_URL or API_KEY is missing in .env');
}
