import type { FastifyInstance } from 'fastify';
import { Character } from '../models/Character.js';
import type { CharacterType } from '../models/Character.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { config } from '../config/config.js';
import sharp from 'sharp';



import { Lorebook } from '../models/Lorebook.js';

export async function characterRoutes(server: FastifyInstance) {
  // Защищаем управление персонажами
  server.addHook('preHandler', server.authenticate);

  server.get('/api/characters', async () => Character.all());

  server.get('/api/characters/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const char = Character.findBySlug(slug);
    if (!char) return reply.code(404).send({ error: 'Character not found' });
    return char;
  });

  server.post('/api/characters', async (request, reply) => {
    const body = request.body as Partial<CharacterType>;
    if (!body.name) return reply.code(400).send({ error: 'Name required' });

    // Простая логика генерации слаг (можно вынести в сервис или оставить тут как UI/DB хелпер)
    const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(7);
    const slug = generateSlug(body.name);

    const newChar = Character.create({ ...body, slug } as CharacterType);
    return newChar;
  });

  server.put('/api/characters/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    const body = request.body as Partial<CharacterType>;
    const updated = Character.update(slug, body as CharacterType);
    return updated;
  });

  server.delete('/api/characters/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    Character.delete(slug);
    return { success: true };
  });

  // Get bound lorebooks for character
  server.get('/api/characters/:id/lorebooks', async (request, reply) => {
    const { id } = request.params as { id: string };
    const charId = parseInt(id, 10);
    if (isNaN(charId)) return reply.code(400).send({ error: 'Invalid character ID' });
    return Lorebook.getCharacterLorebookIds(charId);
  });

  // Update bound lorebooks for character
  server.post('/api/characters/:id/lorebooks', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { lorebook_ids } = request.body as { lorebook_ids?: number[] };
    const charId = parseInt(id, 10);
    if (isNaN(charId)) return reply.code(400).send({ error: 'Invalid character ID' });

    const lbIds = Array.isArray(lorebook_ids) ? lorebook_ids.map(n => Number(n)).filter(n => !isNaN(n)) : [];
    Lorebook.bindToCharacter(charId, lbIds);

    return { success: true, lorebook_ids: lbIds };
  });

  server.post('/api/characters/upload-avatar', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    const buffer = await data.toBuffer();
    const safeFilename = data.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${Date.now()}-${safeFilename}`;
    const storagePath = path.join(__dirname, '../../../storage/avatars', fileName);
    const publicPath = `/storage/avatars/${fileName}`;

    await sharp(buffer)
      .resize({ height: config.avatarHeight })
      .toFile(storagePath);

    return { path: publicPath };
  });

}
