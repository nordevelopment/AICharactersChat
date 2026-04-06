export interface GenerateOptions {
    aspect_ratio?: string;
    resolution?: string;
    model?: string;
    n?: number;
    response_format?: 'url' | 'b64_json';
    steps?: number;
    guidance?: number;
}

export interface EditOptions extends GenerateOptions {
    reference_images: string[];
}

export interface ImageResult {
    success: boolean;
    image_path?: string;
    image_url?: string;
    remote_url?: string;
    is_edit?: boolean;
    error?: string;
}

export interface DeleteResult {
    success: boolean;
    error?: string;
}

export type ImageProviderType = 'xai' | 'together';
