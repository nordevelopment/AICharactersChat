/**
 * Tool Handlers — реализации инструментов.
 * Каждый хендлер принимает args (спарсенный JSON из tool_call)
 * и возвращает строку — результат, который отправляется обратно в модель.
 *
 * Добавляй новые хендлеры в MAP в конце файла.
 */

import fs from 'fs/promises';
import path from 'path';
import { ImageService } from '../services/image.service';

const FILES_DIR = path.join(process.cwd(), 'storage', 'sandbox');
const imageService = new ImageService();

async function ensureFilesDir(): Promise<void> {
    await fs.mkdir(FILES_DIR, { recursive: true });
}

async function handleCreateTextFile(args: Record<string, string>): Promise<string> {
    const { filename, content } = args;

    // Санитизация имени файла — только безопасные символы
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!safeFilename) {
        return 'Error: invalid filename provided.';
    }

    // Запрещаем path traversal
    const targetPath = path.join(FILES_DIR, safeFilename);
    if (!targetPath.startsWith(FILES_DIR)) {
        return 'Error: invalid file path.';
    }

    await ensureFilesDir();
    await fs.writeFile(targetPath, content, 'utf-8');

    return `File "${safeFilename}" created successfully at storage/sandbox/${safeFilename}`;
}

// ─────────────────────────────────────────────
// Хендлер #2: read_text_file
// ─────────────────────────────────────────────
async function handleReadTextFile(args: Record<string, string>): Promise<string> {
    const { filename } = args;

    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!safeFilename) {
        return 'Error: invalid filename provided.';
    }

    const targetPath = path.join(FILES_DIR, safeFilename);
    if (!targetPath.startsWith(FILES_DIR)) {
        return 'Error: invalid file path.';
    }

    try {
        const content = await fs.readFile(targetPath, 'utf-8');
        return `Contents of "${safeFilename}":\n\n${content}`;
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            return `Error: file "${safeFilename}" not found in sandbox.`;
        }
        return `Error reading file "${safeFilename}": ${err.message}`;
    }
}

async function handleGenerateImage(args: Record<string, string>): Promise<string> {
    const { prompt, aspect_ratio } = args;

    if (!prompt) {
        return 'Error: prompt is required';
    }

    try {
        const result = await imageService.generate(prompt, {
            aspect_ratio: aspect_ratio || '1:1'
        });

        if (!result.success) {
            return `Error generating image: ${result.error}`;
        }

        // Возвращаем сразу Markdown-тег, чтобы модель просто «выплюнула» его в чат
        return `![Generated Image](${result.image_url})`;
    } catch (error: any) {
        return `Error generating image: ${error.message}`;
    }
}

type ToolHandler = (args: Record<string, string>) => Promise<string>;

const TOOL_HANDLERS: Record<string, ToolHandler> = {
    create_text_file: handleCreateTextFile,
    read_text_file: handleReadTextFile,
    generate_image: handleGenerateImage,
    // add_calendar_event: handleAddCalendarEvent,
    // search_web: handleSearchWeb,
};

export async function executeTool(name: string, argsJson: string, logger?: any): Promise<string> {
    const handler = TOOL_HANDLERS[name];

    if (!handler) {
        logger?.warn(`[TOOLS] Unknown tool called: "${name}"`);
        return `Error: tool "${name}" is not implemented.`;
    }

    try {
        const args = JSON.parse(argsJson);
        logger?.info({ tool: name, args }, '[TOOLS] Executing tool');
        const result = await handler(args);
        logger?.info({ tool: name, result }, '[TOOLS] Tool executed successfully');
        return result;
    } catch (err: any) {
        logger?.error({ tool: name, error: err.message }, '[TOOLS] Tool execution failed');
        return `Error executing tool "${name}": ${err.message}`;
    }
}
