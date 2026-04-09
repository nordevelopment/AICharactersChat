import { FastifyInstance } from 'fastify';
import { ImageService } from '../services/image';

const imageService = new ImageService();

// Устанавливаем X.AI как провайдер по умолчанию
imageService.setDefaultProvider('xai');

export async function imageRoutes(fastify: FastifyInstance) {
    fastify.post('/api/images/generate', async (request, reply) => {
        try {
            const body = request.body as { 
                prompt: string; 
                aspect_ratio?: string; 
                steps?: number | string; 
                guidance?: number | string;
                provider?: 'xai' | 'together';
            };

            if (!body?.prompt) {
                return reply.code(400).send({ success: false, error: 'Prompt is required' });
            }

            // Convert string parameters to numbers for Together API
            const steps = body.steps ? parseInt(String(body.steps)) : undefined;
            const guidance = body.guidance ? parseFloat(String(body.guidance)) : undefined;

            const result = await imageService.generate(body.prompt, {
                aspect_ratio: body.aspect_ratio,
                steps: steps,
                guidance: guidance
            }, body.provider);

            if (!result.success) {
                return reply.code(400).send(result);
            }

            return reply.code(200).send(result);
        } catch (error: any) {
            fastify.log.error(error);
            return reply.code(500).send({ success: false, error: 'Internal server error while generating image' });
        }
    });

    // Маршрут для редактирования изображений
    fastify.post('/api/images/edit', async (request, reply) => {
        try {
            const body = request.body as { 
                prompt: string; 
                reference_images: string[];
                aspect_ratio?: string; 
                steps?: number | string; 
                guidance?: number | string;
                provider?: 'xai' | 'together';
            };

            if (!body?.prompt) {
                return reply.code(400).send({ success: false, error: 'Prompt is required' });
            }

            if (!body.reference_images || body.reference_images.length === 0) {
                return reply.code(400).send({ success: false, error: 'At least one reference image is required' });
            }

            // Convert string parameters to numbers for Together API
            const steps = body.steps ? parseInt(String(body.steps)) : undefined;
            const guidance = body.guidance ? parseFloat(String(body.guidance)) : undefined;

            const result = await imageService.editImage(body.prompt, {
                reference_images: body.reference_images,
                aspect_ratio: body.aspect_ratio,
                steps: steps,
                guidance: guidance
            }, body.provider);

            if (!result.success) {
                return reply.code(400).send(result);
            }

            return reply.code(200).send(result);
        } catch (error: any) {
            fastify.log.error(error);
            return reply.code(500).send({ success: false, error: 'Internal server error while editing image' });
        }
    });

    // Маршрут для получения информации о провайдерах
    fastify.get('/api/images/providers', async (request, reply) => {
        try {
            const providers = imageService.getAvailableProviders();
            const currentDefault = imageService.getCurrentDefaultProvider();
            
            return reply.code(200).send({
                success: true,
                providers,
                currentDefault
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.code(500).send({ success: false, error: 'Internal server error while getting providers' });
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

    // Get list of all generated images
    fastify.get('/api/images/list', async (request, reply) => {
        try {
            const result = await imageService.listImages();
            return reply.code(200).send(result);
        } catch (error: any) {
            fastify.log.error(error);
            return reply.code(500).send({ success: false, error: 'Internal server error while listing images' });
        }
    });
}
