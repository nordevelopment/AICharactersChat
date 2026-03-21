import { FastifyInstance } from 'fastify';
import { dbRepo } from '../database/sqlite';
import { aiService } from '../services/ai.service';
import { ChatRequestPayload } from '../types';
import { createParser } from 'eventsource-parser';

export async function chatRoutes(server: FastifyInstance) {
  // Защищаем все роуты в этом модуле через хук
  server.addHook('preHandler', server.authenticate);

  server.post('/api/chat', async (request, reply) => {
    const { message, character_id, image } = request.body as ChatRequestPayload;
    if (!character_id) return reply.code(400).send({ error: 'ID required' });

    const activeCharacter = await dbRepo.getCharacterById(character_id);
    if (!activeCharacter) return reply.code(404).send({ error: 'Not found' });

    // Обработка первого контакта
    const historyInDB = await dbRepo.getChatMessages(character_id);
    if (historyInDB.length === 0 && activeCharacter.first_message) {
      await dbRepo.addMessage(character_id, { role: 'assistant', content: activeCharacter.first_message }, 1);
    }

    // Сохраняем текст пользователя
    await dbRepo.addMessage(character_id, { role: 'user', content: message });
    
    // Саммари (в оригинале это было ДО аи вызова)
    await aiService.summarizeIfNeeded(character_id);
    
    const history = await dbRepo.getChatMessages(character_id);

    try {
      const response = await aiService.getStreamingResponse(activeCharacter, history, message, image);

      let fullReply = '';
      return reply.sse((async function* () {
        const parser = createParser({
          onEvent: (event) => {
            if (event.data === '[DONE]') return;
            try {
              const content = JSON.parse(event.data).choices[0]?.delta?.content;
              if (content) fullReply += content;
            } catch (e) {}
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
          await dbRepo.addMessage(character_id, { role: 'assistant', content: fullReply });
        }
      })());
    } catch (error: any) {
      server.log.error(error, 'AI API Error');
      return reply.code(500).send({ error: 'AI Error' });
    }
  });

  server.get('/api/history', async (request) => {
    const { character_id } = request.query as { character_id?: string };
    if (!character_id) return [];
    return await dbRepo.getChatMessages(parseInt(character_id));
  });

  server.delete('/api/history/:id', async (request) => {
    await dbRepo.deleteHistory(parseInt((request.params as any).id));
    return { success: true };
  });

  server.delete('/api/history/all', async () => {
    await dbRepo.deleteAllHistory();
    return { success: true };
  });
}
