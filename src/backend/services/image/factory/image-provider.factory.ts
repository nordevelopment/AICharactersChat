/**
 * Image Provider Factory
 * @author Norayr Petrosyan
 * @version 1.0.0
 */

import { IImageProvider } from '../interfaces/image-provider.interface';
import { ImageProviderType } from '../interfaces/types';
import { XAIImageProvider } from '../providers/xai.provider';
import { TogetherImageProvider } from '../providers/together.provider';

export class ImageProviderFactory {
    private static providers: Map<ImageProviderType, IImageProvider> = new Map();

    /**
     * Get provider instance
     */
    static getProvider(type: ImageProviderType): IImageProvider {
        // If provider already created, return it (singleton)
        if (this.providers.has(type)) {
            return this.providers.get(type)!;
        }

        // Create new instance
        const provider = this.createProvider(type);
        this.providers.set(type, provider);
        return provider;
    }

    /**
     * Create new provider instance
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
     * Get list of available providers
     */
    static getAvailableProviders(): ImageProviderType[] {
        return ['xai', 'together'];
    }

    /**
     * Check if provider is available
     */
    static isProviderAvailable(type: ImageProviderType): boolean {
        return this.getAvailableProviders().includes(type);
    }

    /**
     * Reset providers cache (useful for testing)
     */
    static resetCache(): void {
        this.providers.clear();
    }
}
