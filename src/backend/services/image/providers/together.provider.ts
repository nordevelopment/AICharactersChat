import { config } from '../../../config/config';
import { BaseImageProvider } from './base.provider';
import { GenerateOptions, EditOptions } from '../interfaces/types';

export class TogetherImageProvider extends BaseImageProvider {
    protected apiKey: string;
    protected apiUrl: string;
    protected defaultModel: string;

    constructor() {
        super();
        this.apiKey = config.togetherApiKey || '';
        this.apiUrl = config.togetherApiUrl || 'https://api.together.xyz/v1/images/generations';
        this.defaultModel = config.togetherImageModel || 'black-forest-labs/FLUX.2-dev';
    }

    protected buildGeneratePayload(prompt: string, options: GenerateOptions): any {
        const aspectRatio = options.aspect_ratio || '1:1';
        const [width, height] = this.getDimensions(aspectRatio);

        return {
            model: options.model || this.defaultModel,
            prompt: prompt,
            width,
            height,
            steps: options.steps || 23,
            n: 1,
            guidance: options.guidance || 4,
            output_format: 'png',
            response_format: 'url',
        };
    }

    protected buildEditPayload(prompt: string, options: EditOptions): any {
        const aspectRatio = options.aspect_ratio || '1:1';
        const [width, height] = this.getDimensions(aspectRatio);

        const payload: any = {
            model: options.model || this.defaultModel,
            prompt: prompt,
            width,
            height,
            steps: options.steps || 23,
            n: 1,
            guidance: options.guidance || 4,
            output_format: 'png',
            response_format: 'url',
        };

        // Together AI поддерживает reference_images в том же запросе
        if (options.reference_images && options.reference_images.length > 0) {
            payload.reference_images = options.reference_images;
        }

        return payload;
    }

    private getDimensions(aspectRatio: string): [number, number] {
        // Оптимизировано для FLUX (кратные 32, ~1 MP)
        switch (aspectRatio) {
            case '2:3':
                return [832, 1248];
            case '3:2':
                return [1248, 832];
            case '3:4':
                return [896, 1184];
            case '4:3':
                return [1184, 896];
            case '16:9':
                return [1344, 768];
            case '9:16':
                return [768, 1344];
            case '1:1':
                return [1024, 1024];
            default:
                return [896, 1184];
        }
    }
}
