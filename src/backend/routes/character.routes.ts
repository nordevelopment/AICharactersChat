import { FastifyInstance } from 'fastify';
import { dbRepo } from '../database/sqlite';
import { Character } from '../types';

export async function characterRoutes(server: FastifyInstance) {
  // Защищаем управление персонажами
  server.addHook('preHandler', server.authenticate);

  server.get('/api/characters', async () => await dbRepo.getCharacters());
  
  server.get('/api/characters/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const char = await dbRepo.getCharacterBySlug(slug);
    if (!char) return reply.code(404).send({ error: 'Character not found' });
    return char;
  });

  server.post('/api/characters', async (request, reply) => {
    const body = request.body as Partial<Character>;
    if (!body.name) return reply.code(400).send({ error: 'Name required' });
    
    // Простая логика генерации слаг (можно вынести в сервис или оставить тут как UI/DB хелпер)
    const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(7);
    const slug = generateSlug(body.name);

    const newChar = await dbRepo.createCharacter({ ...body, slug });
    return newChar;
  });

  server.put('/api/characters/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const body = request.body as Partial<Character>;
    const updated = await dbRepo.updateCharacter(slug, body);
    return updated;
  });

  server.delete('/api/characters/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    await dbRepo.deleteCharacter(slug);
    return { success: true };
  });
}
