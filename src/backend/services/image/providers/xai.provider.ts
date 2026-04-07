import { config } from '../../../config/config';
import { BaseImageProvider } from './base.provider';
import { GenerateOptions, EditOptions } from '../interfaces/types';

export class XAIImageProvider extends BaseImageProvider {
    protected apiKey: string;
    protected apiUrl: string = 'https://api.x.ai/v1/images/generations';
    protected editUrl: string = 'https://api.x.ai/v1/images/edits';
    protected defaultModel: string;

    constructor() {
        super();
        this.apiKey = config.xaiApiKey || '';
        this.defaultModel = config.xaiImageModel || 'grok-imagine-image';
    }

    protected buildGeneratePayload(prompt: string, options: GenerateOptions): any {
        return {
            model: options.model || this.defaultModel,
            prompt: prompt,
            n: options.n || 1,
            response_format: options.response_format || 'url',
            ...(options.aspect_ratio && { aspect_ratio: options.aspect_ratio }),
            ...(options.resolution && { resolution: options.resolution }),
        };
    }

    protected buildEditPayload(prompt: string, options: EditOptions): any {
        const payload: any = {
            model: options.model || this.defaultModel,
            prompt: prompt,
            n: options.n || 1,
            response_format: options.response_format || 'url',
            ...(options.aspect_ratio && { aspect_ratio: options.aspect_ratio }),
            ...(options.resolution && { resolution: options.resolution }),
        };

        // Добавляем reference изображения для редактирования
        if (options.reference_images && options.reference_images.length > 0) {
            const limitedRefs = options.reference_images.slice(0, 3); // xAI поддерживает max 3
            payload.images = limitedRefs.map(url => ({
                url: url,
            }));
        }

        return payload;
    }

    protected async makeRequest(payload: any): Promise<any> {
        // Определяем URL в зависимости от типа payload
        const url = payload.images ? this.editUrl : this.apiUrl;

        const axios = require('axios');

        return axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 120000,
        });
    }
}
