import { ImageProviderFactory } from './factory/image-provider.factory';
import { ImageProviderType, GenerateOptions, EditOptions, ImageResult, DeleteResult } from './interfaces/types';
import { IImageProvider } from './interfaces/image-provider.interface';

/**
 * Основной сервис для работы с изображениями
 * Поддерживает множественные провайдеры через фабрику
 */
export class ImageService {
    private defaultProvider: ImageProviderType = 'xai';

    /**
     * Установить провайдер по умолчанию
     */
    setDefaultProvider(provider: ImageProviderType): void {
        if (!ImageProviderFactory.isProviderAvailable(provider)) {
            throw new Error(`Provider ${provider} is not available`);
        }
        this.defaultProvider = provider;
    }

    /**
     * Получить провайдер по умолчанию
     */
    private getDefaultProvider(): IImageProvider {
        return ImageProviderFactory.getProvider(this.defaultProvider);
    }

    /**
     * Получить конкретный провайдер
     */
    getProvider(provider?: ImageProviderType): IImageProvider {
        if (provider) {
            if (!ImageProviderFactory.isProviderAvailable(provider)) {
                throw new Error(`Provider ${provider} is not available`);
            }
            return ImageProviderFactory.getProvider(provider);
        }
        return this.getDefaultProvider();
    }

    /**
     * Генерация изображения из текста
     */
    async generate(
        prompt: string, 
        options: GenerateOptions = {}, 
        provider?: ImageProviderType
    ): Promise<ImageResult> {
        const imageProvider = this.getProvider(provider);
        return imageProvider.generate(prompt, options);
    }

    /**
     * Редактирование изображения с референсами
     */
    async editImage(
        prompt: string, 
        options: EditOptions, 
        provider?: ImageProviderType
    ): Promise<ImageResult> {
        const imageProvider = this.getProvider(provider);
        return imageProvider.editImage(prompt, options);
    }

    /**
     * Удаление изображения
     */
    async deleteImage(
        filename: string, 
        provider?: ImageProviderType
    ): Promise<DeleteResult> {
        const imageProvider = this.getProvider(provider);
        return imageProvider.deleteImage(filename);
    }

    /**
     * List all generated images
     */
    async listImages(): Promise<{ success: boolean; images: any[]; error?: string }> {
        const imageProvider = this.getDefaultProvider();
        return imageProvider.listImages();
    }

    /**
     * Получить список доступных провайдеров
     */
    getAvailableProviders(): ImageProviderType[] {
        return ImageProviderFactory.getAvailableProviders();
    }

    /**
     * Получить текущий провайдер по умолчанию
     */
    getCurrentDefaultProvider(): ImageProviderType {
        return this.defaultProvider;
    }
}
