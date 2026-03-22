import { FastifyInstance } from 'fastify';
import { dbRepo } from '../database/sqlite';
import { aiService } from '../services/ai.service';
import { ChatRequestPayload } from '../types';
import { createParser } from 'eventsource-parser';
import { config } from '../config/config';

export async function chatRoutes(server: FastifyInstance) {
  // Защищаем все роуты в этом модуле через хук
  server.addHook('preHandler', server.authenticate);

  server.post('/api/chat', async (request, reply) => {
    const { message, character_id, image } = request.body as ChatRequestPayload;
    const userId = request.session.user!.id;
    if (!character_id) return reply.code(400).send({ error: 'ID required' });

    const activeCharacter = await dbRepo.getCharacterById(character_id);
    if (!activeCharacter) reply.code(404).send({ error: 'Not found' });

    // Обработка первого контакта
    const historyInDB = await dbRepo.getChatMessages(character_id, userId);
    if (historyInDB.length === 0 && activeCharacter!.first_message) {
      await dbRepo.addMessage(character_id, userId, { role: 'assistant', content: activeCharacter!.first_message }, 1);
    }

    // Сохраняем текст пользователя
    await dbRepo.addMessage(character_id, userId, { role: 'user', content: message });

    // Суммаризация в фоне
    aiService.summarizeIfNeeded(character_id, userId, request.log).catch(err => {
      server.log.error(err, '[AI SERVICE] Background summarization failed');
    });

    const history = await dbRepo.getChatMessages(character_id, userId);

    try {
      const response = await aiService.getStreamingResponse(
        activeCharacter!,
        history,
        message,
        image,
        request.log,
        request.session.user!.display_name
      );

      let fullReply = '';
      let firstChunkLogged = false;
      return reply.sse((async function* () {
        const parser = createParser({
          onEvent: (event) => {
            if (event.data === '[DONE]') return;
            try {
              const data = JSON.parse(event.data);

              // 1. Начальные метаданные
              if (!firstChunkLogged && data.model && config.debugAi) {
                request.log.info({ model: data.model, id: data.id }, '[AI SERVICE] Session Started');
                firstChunkLogged = true;
              }

              // 2. Статистика использования (Usage)
              if (data.usage && config.debugAi) {
                request.log.info({ usage: data.usage }, '[AI SERVICE] Usage Stats Received');
              }

              const content = data.choices?.[0]?.delta?.content;
              if (content) fullReply += content;
            } catch (e) { }
          }
        });

        for await (const chunk of response.data) {
          const prevLength = fullReply.length;
          parser.feed(chunk.toString());
          if (fullReply.length > prevLength) {
            yield { data: JSON.stringify({ reply: fullReply.slice(prevLength) }) };
          }
        }
        yield { data: JSON.stringify({ done: true }) };

        // Save assistant reply
        if (fullReply) {
          if (config.debugAi) {
            request.log.info({ fullText: fullReply }, '[AI SERVICE] Final Assembled Text');
          }
          await dbRepo.addMessage(character_id, userId, { role: 'assistant', content: fullReply });
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
    return await dbRepo.getChatMessages(parseInt(character_id), userId);
  });

  server.delete('/api/history/:id', async (request) => {
    const userId = request.session.user!.id;
    await dbRepo.deleteHistory(parseInt((request.params as any).id), userId);
    return { success: true };
  });

  server.delete('/api/history/all', async (request) => {
    const userId = request.session.user!.id;
    await dbRepo.deleteAllHistory(userId);
    return { success: true };
  });
}
