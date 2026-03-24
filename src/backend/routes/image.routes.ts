import { FastifyInstance } from 'fastify';
import { ImageService } from '../services/image.service';

const imageService = new ImageService();

export async function imageRoutes(fastify: FastifyInstance) {
    fastify.post('/api/images/generate', async (request, reply) => {
        try {
            const body = request.body as { prompt: string; aspect_ratio?: string; steps?: number; guidance?: number };

            if (!body?.prompt) {
                return reply.code(400).send({ success: false, error: 'Prompt is required' });
            }

            const result = await imageService.generate(body.prompt, {
                aspect_ratio: body.aspect_ratio,
                steps: body.steps,
                guidance: body.guidance
            });

            if (!result.success) {
                return reply.code(400).send(result);
            }

            return reply.code(200).send(result);
        } catch (error: any) {
            fastify.log.error(error);
            return reply.code(500).send({ success: false, error: 'Internal server error while generating image' });
        }
    });

    fastify.delete<{ Params: { filename: string } }>('/api/images/:filename', async (request, reply) => {
        try {
            const { filename } = request.params;
            const result = await imageService.deleteImage(filename);

            if (!result.success) {
                return reply.code(400).send(result);
            }
            return reply.code(200).send(result);
        } catch (error: any) {
            fastify.log.error(error);
            return reply.code(500).send({ success: false, error: 'Internal server error while deleting image' });
        }
    });
}
