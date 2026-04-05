/** Tools for AI
 * Tools configuration
 * To enable/disable tools, change the enabled flag
*/

import fs from 'fs/promises';
import path from 'path';
import { ImageService } from '../services/image.service';

type ToolArgs = Record<string, string>;

interface ToolParameter {
    type: string;
    description: string;
    enum?: string[];
    default?: string | number | boolean;
}

interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, ToolParameter>;
            required: string[];
        };
    };
}

interface Tool {
    enabled: boolean;
    definition: ToolDefinition;
    handler: (args: ToolArgs, logger?: any) => Promise<string>;
}

// ─── Shared resources ───────────────────────────────────────────────────────

const FILES_DIR = path.join(process.cwd(), 'storage', 'sandbox');
const imageService = new ImageService();

async function ensureFilesDir(): Promise<void> {
    await fs.mkdir(FILES_DIR, { recursive: true });
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleCreateTextFile({ filename, content }: ToolArgs, logger?: any): Promise<string> {
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!safeFilename) return 'Error: invalid filename provided.';

    const targetPath = path.join(FILES_DIR, safeFilename);
    if (!targetPath.startsWith(FILES_DIR)) return 'Error: invalid file path.';

    let finalContent = content
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    finalContent = finalContent.replace(/^```[a-z]*\r?\n/i, '').replace(/\r?\n```$/g, '');

    await ensureFilesDir();
    await fs.writeFile(targetPath, finalContent, 'utf-8');

    logger?.info({ filename: safeFilename }, '[TOOLS] [create_text_file] File created');
    return `File "${safeFilename}" created successfully at storage/sandbox/${safeFilename}`;
}

async function handleReadTextFile({ filename }: ToolArgs, logger?: any): Promise<string> {
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!safeFilename) return 'Error: invalid filename provided.';

    const targetPath = path.join(FILES_DIR, safeFilename);
    if (!targetPath.startsWith(FILES_DIR)) return 'Error: invalid file path.';

    try {
        const content = await fs.readFile(targetPath, 'utf-8');
        logger?.info({ filename: safeFilename }, '[TOOLS] [read_text_file] File read');
        return `Contents of "${safeFilename}":\n\n${content}`;
    } catch (err: any) {
        logger?.error({ filename: safeFilename, error: err.message }, '[TOOLS] [read_text_file] Failed read');
        if (err.code === 'ENOENT') return `Error: file "${safeFilename}" not found in sandbox.`;
        return `Error reading file "${safeFilename}": ${err.message}`;
    }
}

async function handleGenerateImage({ prompt, aspect_ratio }: ToolArgs, logger?: any): Promise<string> {
    if (!prompt) return 'Error: prompt is required';

    try {
        const result = await imageService.generate(prompt, { aspect_ratio: aspect_ratio || '1:1' }, logger);
        if (!result.success) {
            logger?.error({ prompt, error: result.error }, '[TOOLS] [generate_image] Generation failed');
            return `Error creating image: ${result.error}`;
        }
        logger?.info({ url: result.image_url }, '[TOOLS] [generate_image] Generation success');
        return `${result.image_url}`;
    } catch (error: any) {
        logger?.error({ error: error.message }, '[TOOLS] [generate_image] Exception');
        return `Error creating image: ${error.message}`;
    }
}


// ─── Tools Registry ─────────────────────────────────────────────────────────
const TOOLS: Record<string, Tool> = {

    create_text_file: {
        enabled: false,
        handler: handleCreateTextFile,
        definition: {
            type: 'function',
            function: {
                name: 'create_text_file',
                description: 'Write content to a file. User provides filename and content, or you can suggest them.',
                parameters: {
                    type: 'object',
                    properties: {
                        filename: { type: 'string', description: 'File name (you can suggest appropriate name)' },
                        content: { type: 'string', description: 'Text content to write (user provides or you create)' },
                    },
                    required: ['filename', 'content'],
                },
            },
        },
    },

    read_text_file: {
        enabled: false,
        handler: handleReadTextFile,
        definition: {
            type: 'function',
            function: {
                name: 'read_text_file',
                description: 'Reads the content of a text plain file by filename.',
                parameters: {
                    type: 'object',
                    properties: {
                        filename: { type: 'string', description: 'File name to read. Example: "my_note.txt".' },
                    },
                    required: ['filename'],
                },
            },
        },
    },

    generate_image: {
        enabled: true,
        handler: handleGenerateImage,
        definition: {
            type: 'function',
            function: {
                name: 'generate_image',
                description: 'Generate image based on prompt. No need to return the image URL. The image will display automatically',
                parameters: {
                    type: 'object',
                    properties: {
                        prompt: { type: 'string', description: 'Detailed description of the image to generate (Subject, Action, Style, Context). In English.' },
                        aspect_ratio: { type: 'string', enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '16:9', '9:16'], description: 'Aspect ratio', default: '1:1' },
                    },
                    required: ['prompt'],
                },
            },
        },
    },
};

export const ALL_TOOLS: ToolDefinition[] = Object.values(TOOLS)
    .filter(t => t.enabled)
    .map(t => t.definition);

export async function executeTool(name: string, argsJson: string, logger?: any): Promise<string> {
    const tool = TOOLS[name];

    if (!tool) {
        logger?.warn({ name }, '[TOOLS] Unknown tool called');
        return `Error: tool "${name}" is not implemented.`;
    }

    if (!tool.enabled) {
        logger?.warn({ name }, '[TOOLS] Tool is disabled');
        return `Error: tool "${name}" is currently disabled.`;
    }

    try {
        const args = JSON.parse(argsJson);
        logger?.info({ tool: name, args }, '[TOOLS] Starting execution');

        const result = await tool.handler(args, logger);

        logger?.info({ tool: name, resultLength: result.length }, '[TOOLS] Execution finished');
        return result;
    } catch (err: any) {
        logger?.error({ tool: name, error: err.message, rawArgs: argsJson }, '[TOOLS] Execution error');
        return `Error executing tool "${name}": ${err.message}`;
    }
}
