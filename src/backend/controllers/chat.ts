import { FastifyInstance } from 'fastify';
import { Character as CharacterType, ChatRequestPayload, User } from '../types';
import { Character } from '../models/Character';
import { Message } from '../models/Message';
import { User as UserModel } from '../models/User';
import { aiService } from '../services/ai.service';
import { memoryService } from '../services/memory.service';
import { config } from '../config/config';

export async function chatRoutes(server: FastifyInstance, options?: { logger?: any }) {
  // Защищаем все роуты в этом модуле через хук
  server.addHook('preHandler', server.authenticate);

  server.post('/api/chat', async (request, reply) => {
    const { message, character_id, image } = request.body as ChatRequestPayload;
    const userId = request.session.user!.id;
    request.log.info({ character_id, userId, messageLength: message?.length }, '[CHAT ROUTE] Incoming chat request');
    
    // Validation checks
    if (!character_id) {
      return reply.code(400).send({ error: 'Character ID is required' });
    }
    
    if (!Number.isInteger(Number(character_id)) || Number(character_id) <= 0) {
      return reply.code(400).send({ error: 'Invalid character ID format' });
    }
    
    if (message && (typeof message !== 'string' || message.trim().length === 0)) {
      return reply.code(400).send({ error: 'Message cannot be empty' });
    }
    
    if (message && message.length > 10000) {
      return reply.code(400).send({ error: 'Message too long (max 10000 characters)' });
    }
    
    if (image && typeof image !== 'string') {
      return reply.code(400).send({ error: 'Invalid image format' });
    }
    
    if (image && !image.startsWith('data:image/')) {
      return reply.code(400).send({ error: 'Invalid image format - must be base64 data URL' });
    }

    const activeCharacter = Character.findById(character_id);
    if (!activeCharacter) return reply.code(404).send({ error: 'Not found' });

    // Get full user info including 'about' field
    const userInfo = UserModel.findById(userId);
    if (!userInfo) return reply.code(404).send({ error: 'User not found' });

    request.log.info({ userInfo }, '[CHAT] User info passed to AI service');

    try {
      return reply.sse((async function* () {
        for await (const chunk of aiService.streamChatResponse(
          activeCharacter!,
          userId,
          message,
          image,
          options?.logger || request.log,
          userInfo
        )) {
          if (chunk.reply) {
            yield { data: JSON.stringify({ reply: chunk.reply }) };
          }
          if ((chunk as any).reasoning) {
            yield { data: JSON.stringify({ reasoning: (chunk as any).reasoning }) };
          }
          if (chunk.imageFilePath) {
            yield { data: JSON.stringify({ imageFilePath: chunk.imageFilePath }) };
          }
          if (chunk.done) {
            yield { data: JSON.stringify({ done: true }) };
          }
        }
        request.log.info({ character_id, userId }, '[CHAT ROUTE] Chat turn completed');
      })());
    } catch (error: any) {
      server.log.error(error, 'AI API Error');
      return reply.code(500).send({ error: 'AI Error' });
    }
  });

  server.get('/api/history', async (request) => {
    const { character_id } = request.query as { character_id?: string };
    const userId = request.session.user!.id;
    
    if (!character_id) {
      return [];
    }
    
    if (!Number.isInteger(Number(character_id)) || Number(character_id) <= 0) {
      return [];
    }

    const history = Message.getHistory(parseInt(character_id), userId);

    return history.filter(m => {
      if (m.role === 'tool') return false;
      if (m.role === 'assistant' && m.tool_calls && !m.content) return false;
      return true;
    });
  });

  server.delete('/api/history/:id', async (request, reply) => {
    const userId = request.session.user!.id;
    const characterId = (request.params as any).id;
    
    if (!characterId || !Number.isInteger(Number(characterId)) || Number(characterId) <= 0) {
      return reply.code(400).send({ error: 'Invalid character ID' });
    }
    
    Message.deleteHistory(parseInt(characterId), userId);
    return { success: true };
  });

  server.delete('/api/history/all', async (request) => {
    const userId = request.session.user!.id;
    Message.deleteAll(userId);
    return { success: true };
  });

  // Delete memories for specific character
  server.delete('/api/memory/:characterId', async (request, reply) => {
    const userId = request.session.user!.id;
    const characterId = (request.params as any).characterId;
    
    if (!characterId || !Number.isInteger(Number(characterId)) || Number(characterId) <= 0) {
      return reply.code(400).send({ error: 'Invalid character ID' });
    }
    
    await memoryService.deleteMemories(userId, parseInt(characterId), request.log);
    return { success: true };
  });
}
