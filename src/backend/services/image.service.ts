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

    public async generate(prompt: string, options: GenerateOptions = {}) {
        if (!this.apiUrl || !this.apiKey || !this.model) {
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
                timeout: 90000 // Increased timeout for image generation
            });

            if (response.data && response.data.data && response.data.data[0].url) {

                console.log('Image Data:', response.data);

                const imageUrl = response.data.data[0].url;

                // Download and save locally
                const imageResponse = await axios.get(imageUrl, { 
                    responseType: 'arraybuffer',
                    timeout: 30000 // Timeout for downloading the image
                });

                if (!imageResponse.data) {
                    console.error('Failed to get image', response.data);
                }

                if (!imageResponse.data && response.data.data[0].url) {
                    return {
                        success: true,
                        image_url: response.data.data[0].url,
                        remote_url: response.data.data[0].url
                    };
                }

                const filename = `${randomBytes(5).toString('hex')}_${Date.now()}.png`;
                const generatedDir = path.join(process.cwd(), 'storage', 'generated');

                // Ensure directory exists
                if (!fs.existsSync(generatedDir)) {
                    fs.mkdirSync(generatedDir, { recursive: true });
                }

                const filePath = path.join(generatedDir, filename);

                // Write to file
                fs.writeFileSync(filePath, imageResponse.data);

                console.log({ filePath, imageUrl, filename });

                return {
                    success: true,
                    image_path: filePath,
                    image_url: `/storage/generated/${filename}`,
                    remote_url: imageUrl
                };
            }

            console.error('Error image generation', response.data);
            return { success: false, image_url:null, error: response.data.error || 'Unknown API error' };

        } catch (error: any) {
            let errorMessage = error.message;
            let logContent = error?.response?.data;

            if (error.response) {
                const status = error.response.status;
                if (status === 504) {
                    errorMessage = 'Gateway Timeout: Сервис генерации изображений не ответил вовремя. Попробуйте еще раз.';
                } else if (error.response.data?.error?.message) {
                    errorMessage = error.response.data.error.message;
                }

                // If data is a Buffer (HTML error page), don't log the whole thing
                if (Buffer.isBuffer(logContent)) {
                    logContent = `[Buffer: ${logContent.length} bytes, likely HTML error page]`;
                }
                
                console.error(`Image Service Exception (${status}):`, logContent);
            } else {
                console.error('Image Service Exception:', error.message);
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
