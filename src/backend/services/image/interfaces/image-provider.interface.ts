/**
 * Image Provider Interface
 * @author Norayr Petrosyan
 * @version 1.0.0
 */

import { GenerateOptions, EditOptions, ImageResult, DeleteResult } from './types';

export interface IImageProvider {
    generate(prompt: string, options?: GenerateOptions): Promise<ImageResult>;
    
    editImage(prompt: string, options: EditOptions): Promise<ImageResult>;
    
    deleteImage(filename: string): Promise<DeleteResult>;
    
    listImages(): Promise<{ success: boolean; images: any[]; error?: string }>;
}
