/*
 * X.AI Grok Imagine Image Service (Text-to-Image + Image-to-Image Editing)
 * Актуально на апрель 2026
 */

import axios from 'axios';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/config';

interface GenerateOptions {
    aspect_ratio?: string;      // "1:1", "16:9", "9:16", "3:4", "4:3" и др.
    resolution?: '1k' | '2k';   // качество / разрешение
    model?: string;
    n?: number;                 // 1–10
    response_format?: 'url' | 'b64_json';
}

interface EditOptions extends GenerateOptions {
    reference_images: string[]; // массив URL или data: URI (минимум 1, максимум 3)
}

export class ImageService {
    private apiUrl: string = 'https://api.x.ai/v1/images/generations';
    private editUrl: string = 'https://api.x.ai/v1/images/edits';
    private apiKey: string;
    private defaultModel: string;

    constructor() {
        this.apiKey = config.xaiApiKey || ''; 
        this.defaultModel = config.xaiImageModel || 'grok-imagine-image'; // или 'grok-imagine-image-pro'
    }

    /** Чистая text-to-image генерация */
    public async generate(prompt: string, options: GenerateOptions = {}, logger?: any) {
        return this._request(this.apiUrl, prompt, options, undefined, logger);
    }

    /** Image-to-Image редактирование (основной метод) */
    public async editImage(
        prompt: string, 
        options: EditOptions, 
        logger?: any
    ) {
        if (!options.reference_images || options.reference_images.length === 0) {
            return { success: false, error: 'At least one reference_image is required for editing' };
        }
        if (options.reference_images.length > 3) {
            logger?.warn('xAI supports maximum 3 reference images. Using first 3.');
            options.reference_images = options.reference_images.slice(0, 3);
        }

        return this._request(this.editUrl, prompt, options, options.reference_images, logger);
    }

    /** Внутренний универсальный метод запроса */
    private async _request(
        endpoint: string,
        prompt: string,
        options: GenerateOptions | EditOptions,
        referenceImages?: string[],
        logger?: any
    ) {
        if (!this.apiKey) {
            logger?.error('[IMAGE SERVICE] Missing xAI API key');
            return { success: false, error: 'Missing xAI API key' };
        }

        const safePrompt = prompt.trim();
        if (!safePrompt) {
            return { success: false, error: 'Prompt is required' };
        }

        const payload: any = {
            model: options.model || this.defaultModel,
            prompt: safePrompt,
            n: options.n || 1,
            response_format: options.response_format || 'url',
        };

        if (options.aspect_ratio) payload.aspect_ratio = options.aspect_ratio;
        if (options.resolution) payload.resolution = options.resolution;

        // Для /images/edits добавляем reference изображения
        if (referenceImages && referenceImages.length > 0) {
            payload.images = referenceImages.map(url => ({
                url: url,                    // поддерживается публичный URL или data:image/...;base64,
                // type: "image_url"         // можно добавить, если потребуется
            }));
        }

        try {
            logger?.info({ 
                endpoint: endpoint.split('/').pop(), 
                model: payload.model, 
                hasReference: !!referenceImages 
            }, '[IMAGE SERVICE] Sending request to xAI');

            const response = await axios.post(endpoint, payload, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 180000,
            });

            if (response.data?.data?.[0]?.url) {
                const remoteImageUrl = response.data.data[0].url;

                // Скачивание и сохранение (одинаково для generate и edit)
                let imageResponse;
                const maxRetries = 3;

                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        imageResponse = await axios.get(remoteImageUrl, {
                            responseType: 'arraybuffer',
                            timeout: 60000,
                        });
                        break;
                    } catch (e: any) {
                        if (attempt === maxRetries) throw e;
                        await new Promise(r => setTimeout(r, attempt * 2500));
                    }
                }

                const filename = `${randomBytes(6).toString('hex')}_${Date.now()}.png`;
                const generatedDir = path.join(process.cwd(), 'storage', 'generated');
                if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

                const filePath = path.join(generatedDir, filename);
                fs.writeFileSync(filePath, Buffer.from(imageResponse.data));

                const localUrl = `/storage/generated/${filename}`;

                return {
                    success: true,
                    image_path: filePath,
                    image_url: localUrl,
                    remote_url: remoteImageUrl,
                    is_edit: !!referenceImages,
                };
            }

            return { success: false, error: 'Unexpected API response' };

        } catch (error: any) {
            let errorMessage = error.message;
            if (error.response) {
                const status = error.response.status;
                const apiError = error.response.data?.error?.message || error.response.data;

                logger?.error({ 
                    status, 
                    apiError, 
                    endpoint: endpoint.split('/').pop() 
                }, '[IMAGE SERVICE] xAI Error');

                if (status === 500) {
                    errorMessage = 'xAI server error (500). Проверь, что reference_images — это валидные публичные URL.';
                } else if (apiError) {
                    errorMessage = typeof apiError === 'string' ? apiError : JSON.stringify(apiError);
                }
            }
            return { success: false, error: errorMessage };
        }
    }

    // Метод удаления изображения (оставляем как был)
    public async deleteImage(filename: string) {
        // ... твой оригинальный код ...
    }
}

