import { FastifyInstance } from 'fastify';
import { Character as CharacterType, ChatRequestPayload } from '../types';
import { Character } from '../models/Character';
import { Message } from '../models/Message';
import { aiService } from '../services/ai.service';
import { config } from '../config/config';

export async function chatRoutes(server: FastifyInstance, options?: { logger?: any }) {
  // Защищаем все роуты в этом модуле через хук
  server.addHook('preHandler', server.authenticate);

  server.post('/api/chat', async (request, reply) => {
    const { message, character_id, image } = request.body as ChatRequestPayload;
    const userId = request.session.user!.id;
    if (!character_id) return reply.code(400).send({ error: 'ID required' });

    const activeCharacter = Character.findById(character_id);
    if (!activeCharacter) return reply.code(404).send({ error: 'Not found' });

    // Обработка первого контакта
    const historyInDB = Message.getHistory(character_id, userId);
    if (historyInDB.length === 0 && activeCharacter.first_message) {
      Message.add(character_id, userId, { role: 'assistant', content: activeCharacter.first_message }, 1);
    }

    // Сохраняем текст пользователя
    Message.add(character_id, userId, { role: 'user', content: message });

    // Суммаризация в фоне
    aiService.summarizeIfNeeded(character_id, userId, request.log).catch(err => {
      server.log.error(err, '[AI SERVICE] Background summarization failed');
    });

    const history = Message.getHistory(character_id, userId);

    try {
      let fullReply = '';
      return reply.sse((async function* () {
        for await (const chunk of aiService.streamChatResponse(
          activeCharacter!,
          history,
          message,
          image,
          options?.logger || request.log,
          request.session.user!.display_name
        )) {
          if (chunk.reply) {
            yield { data: JSON.stringify({ reply: chunk.reply }) };
          }
          if (chunk.done) {
            fullReply = chunk.fullReply ?? '';
            yield { data: JSON.stringify({ done: true }) };
          }
        }

        // Сохраняем финальный ответ
        if (fullReply) {
          if (config.debugAi) {
            request.log.info({ fullText: fullReply }, '[AI SERVICE] Final Assembled Text');
          }
          Message.add(character_id, userId, { role: 'assistant', content: fullReply });
        }
      })());
    } catch (error: any) {
      server.log.error(error, 'AI API Error');
      return reply.code(500).send({ error: 'AI Error' });
    }
  });

  server.get('/api/history', async (request) => {
    const { character_id } = request.query as { character_id?: string };
    const userId = request.session.user!.id;
    if (!character_id) return [];
    return Message.getHistory(parseInt(character_id), userId);
  });

  server.delete('/api/history/:id', async (request) => {
    const userId = request.session.user!.id;
    Message.deleteHistory(parseInt((request.params as any).id), userId);
    return { success: true };
  });

  server.delete('/api/history/all', async (request) => {
    const userId = request.session.user!.id;
    Message.deleteAll(userId);
    return { success: true };
  });
}
