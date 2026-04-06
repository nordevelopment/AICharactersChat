import axios from 'axios';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/config';

interface GenerateOptions {
    aspect_ratio?: string;
    model?: string;
    steps?: number;
    guidance?: number;
    reference_images?: string[];
}

export class ImageService {
    private apiUrl: string;
    private apiKey: string;
    private model: string;

    constructor() {
        this.apiUrl = config.togetherApiUrl;
        this.apiKey = config.togetherApiKey;
        this.model = config.togetherImageModel;
    }

    public async generate(prompt: string, options: GenerateOptions = {}, logger?: any) {
        if (!this.apiUrl || !this.apiKey || !this.model) {
            logger?.error('[IMAGE SERVICE] Missing configuration');
            return { success: false, error: 'Missing Together AI configuration' };
        }

        const aspectRatio = options.aspect_ratio || '1:1';
        const [width, height] = this.getDimensions(aspectRatio);

        const safePrompt = prompt.trim();

        const payload: any = {
            model: options.model || this.model,
            prompt: safePrompt,
            width,
            height,
            steps: options.steps || 23,
            n: 1,
            guidance: options.guidance || 4,
            output_format: 'png',
            response_format: 'url' // Best practice: use URL
        };

        if (options.reference_images && options.reference_images.length > 0) {
            payload.reference_images = options.reference_images;
        }

        try {
            const response = await axios.post(this.apiUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.data && response.data.data && response.data.data[0].url) {
                const remoteImageUrl = response.data.data[0].url;
                logger?.info({ remoteImageUrl }, '[IMAGE SERVICE] Image received from API');

                // Download and save locally with retries
                let imageResponse;
                const maxRetries = 3;
                
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        imageResponse = await axios.get(remoteImageUrl, {
                            responseType: 'arraybuffer',
                            timeout: 45000 // Немного увеличим таймаут для самого скачивания
                        });
                        break; // Если успешно — выходим из цикла
                    } catch (downloadError: any) {
                        if (attempt === maxRetries) {
                            logger?.error({ attempt, error: downloadError.message }, '[IMAGE SERVICE] All download attempts failed');
                            throw downloadError; // Пробрасываем ошибку дальше, если все попытки провалены
                        }
                        
                        const delay = attempt * 2000; // 2s, 4s...
                        logger?.warn({ attempt, delay, error: downloadError.message }, '[IMAGE SERVICE] Download failed, retrying...');
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }

                const filename = `${randomBytes(5).toString('hex')}_${Date.now()}.png`;
                const generatedDir = path.join(process.cwd(), 'storage', 'generated');

                if (!fs.existsSync(generatedDir)) {
                    fs.mkdirSync(generatedDir, { recursive: true });
                }

                const filePath = path.join(generatedDir, filename);

                if (imageResponse && imageResponse.data) {
                    fs.writeFileSync(filePath, imageResponse.data);
                } else {
                    throw new Error('Failed to download image: No response data');
                }

                const imageUrl = `/storage/generated/${filename}`;

                logger?.info({ filePath, filename, imageUrl }, '[IMAGE SERVICE] Image saved locally');

                return {
                    success: true,
                    image_path: filePath,
                    image_url: imageUrl,
                    remote_url: remoteImageUrl
                };
            }

            logger?.error({ response: response.data }, '[IMAGE SERVICE] Error in generation response');
            return { success: false, image_url: null, error: response.data.error || 'Unknown API error' };

        } catch (error: any) {
            let errorMessage = error.message;
            let logContent = error?.response?.data;

            if (error.response) {
                const status = error.response.status;
                if (status === 504) {
                    errorMessage = 'Gateway Timeout.';
                } else if (error.response.data?.error?.message) {
                    errorMessage = error.response.data.error.message;
                }

                if (Buffer.isBuffer(logContent)) {
                    logContent = `[Buffer: ${logContent.length} bytes]`;
                }

                logger?.error({ status, data: logContent }, '[IMAGE SERVICE] API Exception');
            } else {
                logger?.error({ error: error.message }, '[IMAGE SERVICE] Exception');
            }

            return { success: false, error: errorMessage };
        }
    }

    public async deleteImage(filename: string) {
        try {
            if (!filename || filename.includes('..') || filename.includes('/')) {
                return { success: false, error: 'Invalid filename' };
            }

            const generatedDir = path.join(process.cwd(), 'storage', 'generated');
            const filePath = path.join(generatedDir, filename);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return { success: true };
            }

            return { success: false, error: 'File not found' };
        } catch (error: any) {
            console.error('Error deleting image:', error.message);
            return { success: false, error: error.message };
        }
    }

    private getDimensions(aspectRatio: string): [number, number] {
        // Optimized for FLUX (multiples of 32, ~1 MP)
        switch (aspectRatio) {
            case '2:3':
                return [832, 1248];
            case '3:2':
                return [1248, 832];
            case '3:4':
                return [896, 1184]; // Almost perfect 3:4 calculation (0.756)
            case '4:3':
                return [1184, 896];
            case '16:9':
                return [1344, 768]; // Cinematic
            case '9:16':
                return [768, 1344]; // Perfect for mobile / stories
            case '1:1':
                return [1024, 1024];
            default:
                return [896, 1184]; // Default 3:4, but high quality
        }
    }
}
