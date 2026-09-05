import type { FastifyInstance } from 'fastify';
import { Lorebook } from '../models/Lorebook.js';

export async function lorebookRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List all lorebooks for current user
  server.get('/api/lorebooks', async (request) => {
    const userId = request.session.user!.id;
    return Lorebook.allByUser(userId);
  });

  // Create a new lorebook
  server.post('/api/lorebooks', async (request, reply) => {
    const userId = request.session.user!.id;
    const { name, description } = request.body as { name?: string; description?: string };

    if (!name || name.trim().length === 0) {
      return reply.code(400).send({ error: 'Lorebook name is required' });
    }

    const lb = Lorebook.create(userId, name.trim(), description);
    return lb;
  });

  // Get specific lorebook with entries
  server.get('/api/lorebooks/:id', async (request, reply) => {
    const userId = request.session.user!.id;
    const { id } = request.params as { id: string };
    const lbId = parseInt(id, 10);

    if (isNaN(lbId)) {
      return reply.code(400).send({ error: 'Invalid lorebook ID' });
    }

    const lb = Lorebook.findById(lbId, userId);
    if (!lb) {
      return reply.code(404).send({ error: 'Lorebook not found' });
    }

    return lb;
  });

  // Update lorebook
  server.put('/api/lorebooks/:id', async (request, reply) => {
    const userId = request.session.user!.id;
    const { id } = request.params as { id: string };
    const { name, description } = request.body as { name?: string; description?: string };
    const lbId = parseInt(id, 10);

    if (isNaN(lbId)) {
      return reply.code(400).send({ error: 'Invalid lorebook ID' });
    }

    if (!name || name.trim().length === 0) {
      return reply.code(400).send({ error: 'Lorebook name is required' });
    }

    const updated = Lorebook.update(lbId, userId, name.trim(), description);
    if (!updated) {
      return reply.code(404).send({ error: 'Lorebook not found' });
    }

    return updated;
  });

  // Delete lorebook
  server.delete('/api/lorebooks/:id', async (request, reply) => {
    const userId = request.session.user!.id;
    const { id } = request.params as { id: string };
    const lbId = parseInt(id, 10);

    if (isNaN(lbId)) {
      return reply.code(400).send({ error: 'Invalid lorebook ID' });
    }

    const success = Lorebook.delete(lbId, userId);
    if (!success) {
      return reply.code(404).send({ error: 'Lorebook not found' });
    }

    return { success: true };
  });

  // Create entry inside lorebook
  server.post('/api/lorebooks/:id/entries', async (request, reply) => {
    const userId = request.session.user!.id;
    const { id } = request.params as { id: string };
    const { keys, content, comment, is_active } = request.body as {
      keys?: string[] | string;
      content?: string;
      comment?: string;
      is_active?: boolean;
    };
    const lbId = parseInt(id, 10);

    if (isNaN(lbId)) {
      return reply.code(400).send({ error: 'Invalid lorebook ID' });
    }

    const lb = Lorebook.findById(lbId, userId);
    if (!lb) {
      return reply.code(404).send({ error: 'Lorebook not found' });
    }

    let keysArray: string[] = [];
    if (Array.isArray(keys)) {
      keysArray = keys;
    } else if (typeof keys === 'string') {
      keysArray = keys.split(',').map(k => k.trim()).filter(Boolean);
    }

    if (keysArray.length === 0) {
      return reply.code(400).send({ error: 'At least one trigger key is required' });
    }

    if (!content || content.trim().length === 0) {
      return reply.code(400).send({ error: 'Entry content is required' });
    }

    const entry = Lorebook.createEntry(lbId, keysArray, content.trim(), comment, is_active ?? true);
    return entry;
  });

  // Update entry
  server.put('/api/lorebooks/entries/:entryId', async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    const { keys, content, comment, is_active } = request.body as {
      keys?: string[] | string;
      content?: string;
      comment?: string;
      is_active?: boolean;
    };
    const eId = parseInt(entryId, 10);

    if (isNaN(eId)) {
      return reply.code(400).send({ error: 'Invalid entry ID' });
    }

    let keysArray: string[] = [];
    if (Array.isArray(keys)) {
      keysArray = keys;
    } else if (typeof keys === 'string') {
      keysArray = keys.split(',').map(k => k.trim()).filter(Boolean);
    }

    if (keysArray.length === 0) {
      return reply.code(400).send({ error: 'At least one trigger key is required' });
    }

    if (!content || content.trim().length === 0) {
      return reply.code(400).send({ error: 'Entry content is required' });
    }

    const updated = Lorebook.updateEntry(eId, keysArray, content.trim(), comment, is_active ?? true);
    if (!updated) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    return updated;
  });

  // Delete entry
  server.delete('/api/lorebooks/entries/:entryId', async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    const eId = parseInt(entryId, 10);

    if (isNaN(eId)) {
      return reply.code(400).send({ error: 'Invalid entry ID' });
    }

    const success = Lorebook.deleteEntry(eId);
    if (!success) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    return { success: true };
  });

  // Import SillyTavern JSON
  server.post('/api/lorebooks/import', async (request, reply) => {
    const userId = request.session.user!.id;
    let name = 'Imported Lorebook';
    let jsonData: any = null;

    if (request.isMultipart()) {
      const file = await request.file();
      if (!file) return reply.code(400).send({ error: 'No file uploaded' });
      const buf = await file.toBuffer();
      try {
        jsonData = JSON.parse(buf.toString('utf-8'));
      } catch {
        return reply.code(400).send({ error: 'Invalid JSON file format' });
      }
      if (file.filename) {
        name = file.filename.replace(/\.json$/i, '');
      }
    } else {
      const body = request.body as { name?: string; jsonContent?: any };
      if (!body.jsonContent) {
        return reply.code(400).send({ error: 'Missing jsonContent body' });
      }
      jsonData = typeof body.jsonContent === 'string' ? JSON.parse(body.jsonContent) : body.jsonContent;
      if (body.name) name = body.name;
    }

    if (!jsonData) {
      return reply.code(400).send({ error: 'Could not parse JSON content' });
    }

    const lb = Lorebook.importSillyTavernJSON(userId, name, jsonData);
    return lb;
  });

  // Export SillyTavern JSON file download
  server.get('/api/lorebooks/:id/export', async (request, reply) => {
    const userId = request.session.user!.id;
    const { id } = request.params as { id: string };
    const lbId = parseInt(id, 10);

    if (isNaN(lbId)) {
      return reply.code(400).send({ error: 'Invalid lorebook ID' });
    }

    const exportData = Lorebook.exportToJSON(lbId, userId);
    if (!exportData) {
      return reply.code(404).send({ error: 'Lorebook not found' });
    }

    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="lorebook-${lbId}.json"`)
      .send(JSON.stringify(exportData, null, 2));
  });
}
