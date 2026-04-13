import axios from 'axios';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { IImageProvider } from '../interfaces/image-provider.interface';
import { GenerateOptions, EditOptions, ImageResult, DeleteResult } from '../interfaces/types';

export abstract class BaseImageProvider implements IImageProvider {
    protected abstract apiKey: string;
    protected abstract apiUrl: string;
    protected abstract defaultModel: string;

    /**
     * Генерация изображения из текста
     */
    public async generate(prompt: string, options: GenerateOptions = {}): Promise<ImageResult> {
        const safePrompt = prompt.trim();
        if (!safePrompt) {
            return { success: false, error: 'Prompt is required' };
        }

        if (!this.apiKey) {
            return { success: false, error: 'Missing API key' };
        }

        try {
            const payload = this.buildGeneratePayload(safePrompt, options);
            const response = await this.makeRequest(payload);

            if (response.data?.data?.[0]?.url) {
                return await this.downloadAndSave(response.data.data[0].url, false);
            }

            return { success: false, error: 'Unexpected API response' };
        } catch (error: any) {
            return this.handleError(error, 'generate');
        }
    }

    /**
     * Редактирование изображения с референсами
     */
    public async editImage(prompt: string, options: EditOptions): Promise<ImageResult> {
        const safePrompt = prompt.trim();
        if (!safePrompt) {
            return { success: false, error: 'Prompt is required' };
        }

        if (!options.reference_images || options.reference_images.length === 0) {
            return { success: false, error: 'At least one reference image is required for editing' };
        }

        if (!this.apiKey) {
            return { success: false, error: 'Missing API key' };
        }

        try {
            const payload = this.buildEditPayload(safePrompt, options);
            const response = await this.makeRequest(payload);

            if (response.data?.data?.[0]?.url) {
                return await this.downloadAndSave(response.data.data[0].url, true);
            }

            return { success: false, error: 'Unexpected API response' };
        } catch (error: any) {
            return this.handleError(error, 'edit');
        }
    }

    /**
     * Удаление локального файла
     */
    public async deleteImage(filename: string): Promise<DeleteResult> {
        try {
            // Предотвращаем Path Traversal (поддержка / и \ для Windows)
            if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                return { success: false, error: 'Invalid filename' };
            }

            // Дополнительная проверка через basename
            if (filename !== path.basename(filename)) {
                return { success: false, error: 'Invalid filename format' };
            }

            const generatedDir = path.join(process.cwd(), 'storage', 'generated');
            const filePath = path.join(generatedDir, filename);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return { success: true };
            }

            return { success: false, error: 'File not found' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Скачивание и сохранение изображения
     */
    protected async downloadAndSave(remoteImageUrl: string, isEdit: boolean): Promise<ImageResult> {
        let imageResponse;
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                imageResponse = await axios.get(remoteImageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 60000,
                });
                break;
            } catch (e: any) {
                if (attempt === maxRetries) throw e;
                await new Promise(r => setTimeout(r, attempt * 2500));
            }
        }

        const filename = `${randomBytes(6).toString('hex')}_${Date.now()}.png`;
        const generatedDir = path.join(process.cwd(), 'storage', 'generated');

        if (!fs.existsSync(generatedDir)) {
            fs.mkdirSync(generatedDir, { recursive: true });
        }

        const filePath = path.join(generatedDir, filename);
        fs.writeFileSync(filePath, Buffer.from(imageResponse!.data));

        const localUrl = `/storage/generated/${filename}`;

        return {
            success: true,
            image_path: filePath,
            image_url: localUrl,
            remote_url: remoteImageUrl,
            is_edit: isEdit,
        };
    }

    /**
     * Выполнение HTTP запроса к API
     */
    protected async makeRequest(payload: any): Promise<any> {
        return axios.post(this.apiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 120000,
        });
    }

    /**
     * Обработка ошибок
     */
    protected handleError(error: any, operation: string): ImageResult {
        let errorMessage = error.message;

        if (error.response) {
            const status = error.response.status;
            const apiError = error.response.data?.error?.message || error.response.data;

            if (status === 500) {
                errorMessage = 'Server error (500). Check your request parameters.';
            } else if (apiError) {
                errorMessage = typeof apiError === 'string' ? apiError : JSON.stringify(apiError);
            }
        }

        return { success: false, error: errorMessage };
    }

    /**
     * List all generated images
     */
    async listImages(): Promise<{ success: boolean; images: any[]; error?: string }> {
        try {
            const fs = require('fs');
            const path = require('path');
            
            const generatedDir = path.join(process.cwd(), 'storage', 'generated');
            
            if (!fs.existsSync(generatedDir)) {
                return { success: true, images: [] };
            }
            
            const files = fs.readdirSync(generatedDir);
            const imageFiles = files
                .filter((file: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
                .map((file: string) => {
                    const filePath = path.join(generatedDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        filename: file,
                        created_at: stats.birthtime.toISOString(),
                        size: stats.size
                    };
                })
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
            return { success: true, images: imageFiles };
        } catch (error: any) {
            return { success: false, images: [], error: error.message };
        }
    }

    /**
     * Построение payload для генерации (должен быть реализован в наследниках)
     */
    protected abstract buildGeneratePayload(prompt: string, options: GenerateOptions): any;

    /**
     * Построение payload для редактирования (должен быть реализован в наследниках)
     */
    protected abstract buildEditPayload(prompt: string, options: EditOptions): any;
}
