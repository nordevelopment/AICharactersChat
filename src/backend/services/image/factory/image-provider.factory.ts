import { IImageProvider } from '../interfaces/image-provider.interface';
import { ImageProviderType } from '../interfaces/types';
import { XAIImageProvider } from '../providers/xai.provider';
import { TogetherImageProvider } from '../providers/together.provider';

export class ImageProviderFactory {
    private static providers: Map<ImageProviderType, IImageProvider> = new Map();

    /**
     * Получить экземпляр провайдера
     */
    static getProvider(type: ImageProviderType): IImageProvider {
        // Если провайдер уже создан, возвращаем его (singleton)
        if (this.providers.has(type)) {
            return this.providers.get(type)!;
        }

        // Создаем новый экземпляр
        const provider = this.createProvider(type);
        this.providers.set(type, provider);
        return provider;
    }

    /**
     * Создать новый экземпляр провайдера
     */
    private static createProvider(type: ImageProviderType): IImageProvider {
        switch (type) {
            case 'xai':
                return new XAIImageProvider();
            case 'together':
                return new TogetherImageProvider();
            default:
                throw new Error(`Unsupported image provider: ${type}`);
        }
    }

    /**
     * Получить список доступных провайдеров
     */
    static getAvailableProviders(): ImageProviderType[] {
        return ['xai', 'together'];
    }

    /**
     * Проверить, доступен ли провайдер
     */
    static isProviderAvailable(type: ImageProviderType): boolean {
        return this.getAvailableProviders().includes(type);
    }

    /**
     * Сбросить кэш провайдеров (полезно для тестирования)
     */
    static resetCache(): void {
        this.providers.clear();
    }
}
