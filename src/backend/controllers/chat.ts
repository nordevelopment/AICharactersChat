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
    request.log.info({ character_id, userId, messageLength: message?.length }, '[CHAT ROUTE] Incoming chat request');
    if (!character_id) return reply.code(400).send({ error: 'ID required' });

    const activeCharacter = Character.findById(character_id);
    if (!activeCharacter) return reply.code(404).send({ error: 'Not found' });

    try {
      return reply.sse((async function* () {
        for await (const chunk of aiService.streamChatResponse(
          activeCharacter!,
          userId,
          message,
          image,
          options?.logger || request.log,
          request.session.user!.display_name
        )) {
          if (chunk.reply) {
            yield { data: JSON.stringify({ reply: chunk.reply }) };
          }
          if ((chunk as any).reasoning) {
            yield { data: JSON.stringify({ reasoning: (chunk as any).reasoning }) };
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
    if (!character_id) return [];

    const history = Message.getHistory(parseInt(character_id), userId);

    // Скрываем технические сообщения от пользователя, но сохраняем их для ИИ
    return history.filter(m => {
      // Скрываем сообщения tool (результаты инструментов)
      if (m.role === 'tool') return false;
      // Скрываем assistant сообщения с tool_calls (промежуточные вызовы)
      if (m.role === 'assistant' && m.tool_calls && !m.content) return false;
      return true;
    });
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
