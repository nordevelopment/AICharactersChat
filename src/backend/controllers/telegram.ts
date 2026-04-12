import { FastifyInstance } from 'fastify';
import { TelegramAdapter } from '../adapters/telegram/telegram.adapter';
import { TelegramService } from '../adapters/telegram/telegram.service';
import { telegramConfig } from '../adapters/telegram/telegram.config';

// Global adapter instance
let telegramAdapter: TelegramAdapter;

export async function telegramRoutes(server: FastifyInstance) {
  // Initialize Telegram adapter
  const telegramService = new TelegramService();
  telegramAdapter = new TelegramAdapter(telegramService, server.log);

  // Initialize adapter on startup
  try {
    await telegramAdapter.initialize();
  } catch (error) {
    server.log.error({ error }, '[TELEGRAM ROUTES] Failed to initialize Telegram adapter');
    // Don't throw error to allow server to start without Telegram
  }

  // Webhook endpoint for Telegram
  server.post('/webhook/telegram', {
    preHandler: validateWebhook,
    config: {
      rateLimit: {
        max: telegramConfig.rateLimitPerUser,
        timeWindow: telegramConfig.rateLimitWindow * 1000 // Convert to milliseconds
      }
    }
  }, async (request, reply) => {
    try {
      await telegramAdapter.handleIncomingMessage(request.body);
      return { status: 'ok' };
    } catch (error) {
      server.log.error({ error }, '[TELEGRAM ROUTES] Webhook processing failed');
      return reply.code(500).send({ status: 'error', message: 'Internal server error' });
    }
  });

  // Health check endpoint
  server.get('/webhook/telegram/health', async (request, reply) => {
    try {
      const isConfigured = telegramAdapter.isConfigured();
      const botInfo = isConfigured ? await telegramService.getMe() : null;
      
      return {
        status: isConfigured ? 'healthy' : 'misconfigured',
        configured: isConfigured,
        bot: botInfo ? {
          id: botInfo.id,
          username: botInfo.username,
          first_name: botInfo.first_name
        } : null,
        webhook: telegramConfig.webhookUrl || 'not set',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      server.log.error({ error }, '[TELEGRAM ROUTES] Health check failed');
      return reply.code(500).send({ status: 'error', message: 'Health check failed' });
    }
  });

  // Set webhook endpoint (for admin use)
  server.post('/webhook/telegram/set', {
    preHandler: requireAdmin
  }, async (request, reply) => {
    try {
      const { webhookUrl, secretToken } = request.body as { webhookUrl?: string; secretToken?: string };
      
      if (!webhookUrl) {
        return reply.code(400).send({ error: 'webhookUrl is required' });
      }

      await telegramService.setWebhook(webhookUrl, secretToken);
      
      server.log.info({ webhookUrl }, '[TELEGRAM ROUTES] Webhook updated');
      
      return {
        status: 'success',
        webhookUrl,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      server.log.error({ error }, '[TELEGRAM ROUTES] Failed to set webhook');
      return reply.code(500).send({ error: 'Failed to set webhook' });
    }
  });

  // Remove webhook endpoint
  server.delete('/webhook/telegram', {
    preHandler: requireAdmin
  }, async (request, reply) => {
    try {
      await telegramService.deleteWebhook();
      
      server.log.info('[TELEGRAM ROUTES] Webhook removed');
      
      return {
        status: 'success',
        message: 'Webhook removed successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      server.log.error({ error }, '[TELEGRAM ROUTES] Failed to remove webhook');
      return reply.code(500).send({ error: 'Failed to remove webhook' });
    }
  });

  // Get webhook info
  server.get('/webhook/telegram/info', {
    preHandler: requireAdmin
  }, async (request, reply) => {
    try {
      const webhookInfo = await telegramService.getWebhookInfo();
      return webhookInfo;
    } catch (error) {
      server.log.error({ error }, '[TELEGRAM ROUTES] Failed to get webhook info');
      return reply.code(500).send({ error: 'Failed to get webhook info' });
    }
  });

  // Send message endpoint (for testing/admin use)
  server.post('/webhook/telegram/send', {
    preHandler: requireAdmin
  }, async (request, reply) => {
    try {
      const { chatId, message, options } = request.body as { 
        chatId: number | string; 
        message: string; 
        options?: any 
      };
      
      if (!chatId || !message) {
        return reply.code(400).send({ error: 'chatId and message are required' });
      }

      await telegramAdapter.sendMessage(chatId, message, options);
      
      return {
        status: 'success',
        chatId,
        messageLength: message.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      server.log.error({ error }, '[TELEGRAM ROUTES] Failed to send message');
      return reply.code(500).send({ error: 'Failed to send message' });
    }
  });
}

// Middleware to validate webhook requests
async function validateWebhook(request: any, reply: any) {
  const secretToken = request.headers['x-telegram-bot-api-secret-token'];
  
  if (telegramConfig.webhookSecret && secretToken !== telegramConfig.webhookSecret) {
    request.log.warn({ 
      receivedToken: secretToken, 
      expectedToken: telegramConfig.webhookSecret 
    }, '[TELEGRAM WEBHOOK] Invalid secret token');
    
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

// Middleware to require admin access
async function requireAdmin(request: any, reply: any) {
  // This is a simple implementation - in production you'd want proper authentication
  const adminKey = request.headers['x-admin-key'];
  
  if (!telegramConfig.adminUsers.includes('webhook_admin') && adminKey !== process.env.ADMIN_KEY) {
    return reply.code(403).send({ error: 'Admin access required' });
  }
}

// Export adapter for use in other parts of the application
export function getTelegramAdapter(): TelegramAdapter {
  return telegramAdapter;
}
