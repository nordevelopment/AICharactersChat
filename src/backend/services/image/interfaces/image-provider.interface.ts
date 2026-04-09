import { GenerateOptions, EditOptions, ImageResult, DeleteResult } from './types';

export interface IImageProvider {
    /**
     * Генерация изображения из текста
     */
    generate(prompt: string, options?: GenerateOptions): Promise<ImageResult>;
    
    /**
     * Редактирование изображения с референсами
     */
    editImage(prompt: string, options: EditOptions): Promise<ImageResult>;
    
    /**
     * Удаление локального файла
     */
    deleteImage(filename: string): Promise<DeleteResult>;
    
    /**
     * List all generated images
     */
    listImages(): Promise<{ success: boolean; images: any[]; error?: string }>;
}
