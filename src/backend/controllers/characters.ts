import { FastifyInstance } from 'fastify';
import { Character as CharacterType } from '../types';
import { Character } from '../models/Character';
import path from 'path';
import fs from 'fs';
import { config } from '../config/config';
import sharp from 'sharp';

export async function characterRoutes(server: FastifyInstance) {
  // Защищаем управление персонажами
  server.addHook('preHandler', server.authenticate);

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

    const newChar = Character.create({ ...body, slug });
    return newChar;
  });

  server.put('/api/characters/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const body = request.body as Partial<CharacterType>;
    const updated = Character.update(slug, body);
    return updated;
  });

  server.delete('/api/characters/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    Character.delete(slug);
    return { success: true };
  });
}
