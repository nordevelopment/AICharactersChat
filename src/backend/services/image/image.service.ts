/**
 * Image service for generating and editing images
 * Supports multiple providers through factory
 * @author Norayr Petrosyan
 * @version 1.5.0
 */

import { ImageProviderFactory } from './factory/image-provider.factory';
import { ImageProviderType, GenerateOptions, EditOptions, ImageResult, DeleteResult } from './interfaces/types';
import { IImageProvider } from './interfaces/image-provider.interface';

export class ImageService {
    private defaultProvider: ImageProviderType = 'xai';

    /**
     * Set default provider
     */
    setDefaultProvider(provider: ImageProviderType): void {
        if (!ImageProviderFactory.isProviderAvailable(provider)) {
            throw new Error(`Provider ${provider} is not available`);
        }
        this.defaultProvider = provider;
    }

    /**
     * Get default provider
     */
    private getDefaultProvider(): IImageProvider {
        return ImageProviderFactory.getProvider(this.defaultProvider);
    }

    /**
     * Get specific provider
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
     * Generate image from text
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
     * Edit image with references
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
     * Delete image
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
     * Get list of available providers
     */
    getAvailableProviders(): ImageProviderType[] {
        return ImageProviderFactory.getAvailableProviders();
    }

    /**
     * Get current default provider
     */
    getCurrentDefaultProvider(): ImageProviderType {
        return this.defaultProvider;
    }
}
