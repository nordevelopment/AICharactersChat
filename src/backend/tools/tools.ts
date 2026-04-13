/** Tools for AI
 * Tools configuration
 * To enable/disable tools, change the enabled flag
 */

import fs from 'fs/promises';
import path from 'path';
import { ImageService } from '../services/image';
import { ImageProviderType } from '../services/image/interfaces/types';
import { memoryService } from '../services/memory.service';
import { TelegramService } from '../adapters/telegram/telegram.service';
import { telegramConfig } from '../adapters/telegram/telegram.config';

type ToolArgs = Record<string, string | number | undefined>;

interface ToolContext {
    userId: number;
    characterId: number;
}

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
    handler: (args: ToolArgs, logger?: any, context?: ToolContext) => Promise<string>;
}

// Shared resources

const FILES_DIR = path.join(process.cwd(), 'storage', 'sandbox');
const imageService = new ImageService();

async function ensureFilesDir(): Promise<void> {
    await fs.mkdir(FILES_DIR, { recursive: true });
}

// Handlers

async function handleCreateTextFile({ filename, content }: ToolArgs, logger?: any): Promise<string> {
    const safeFilename = String(filename || '').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!safeFilename || safeFilename.length === 0) {
      return 'Error: invalid filename provided.';
    }
    
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(safeFilename.toUpperCase()) || safeFilename.includes('..') || safeFilename.includes('/') || safeFilename.includes('\\')) {
      return 'Error: invalid or unsafe filename.';
    }
    
    if (safeFilename.length > 255) {
      return 'Error: filename too long (max 255 characters).';
    }

    const targetPath = path.join(FILES_DIR, safeFilename);
    if (!targetPath.startsWith(FILES_DIR)) return 'Error: invalid file path.';

    let finalContent = String(content || '')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/&/g, '&')
        .replace(/"/g, '"')
        .replace(/&#39;/g, "'");

    finalContent = finalContent.replace(/^```[a-z]*\r?\n/i, '').replace(/\r?\n```$/g, '');

    await ensureFilesDir();
    await fs.writeFile(targetPath, finalContent, 'utf-8');

    logger?.info({ filename: safeFilename }, '[TOOLS] [create_text_file] File created');
    return `File "${safeFilename}" created successfully at storage/sandbox/${safeFilename}`;
}

async function handleReadTextFile({ filename }: ToolArgs, logger?: any): Promise<string> {
    const safeFilename = String(filename || '').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!safeFilename || safeFilename.length === 0) {
      return 'Error: invalid filename provided.';
    }
    
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(safeFilename.toUpperCase()) || safeFilename.includes('..') || safeFilename.includes('/') || safeFilename.includes('\\')) {
      return 'Error: invalid or unsafe filename.';
    }
    
    if (safeFilename.length > 255) {
      return 'Error: filename too long (max 255 characters).';
    }

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

async function handleGenerateImage({ prompt, aspect_ratio, provider }: ToolArgs, logger?: any): Promise<string> {
    if (!prompt) return 'Error: prompt is required';

    try {
        const result = await imageService.generate(String(prompt), { aspect_ratio: String(aspect_ratio || '1:1') }, provider as ImageProviderType);
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

// Telegram tool handlers
async function handlePostToTelegramChannel({ message }: ToolArgs, logger?: any): Promise<string> {
    if (!message) return 'Error: message is required';
    
    const targetChannel = telegramConfig.channel;
    
    if (!targetChannel) {
        return 'Error: no channel configured. Please set TELEGRAM_CHANNEL in .env';
    }

    // Check if channel is allowed
    if (!telegramConfig.isChannelAllowed(targetChannel)) {
        return `Error: default channel "${targetChannel}" is not in the allowed channels list`;
    }

    try {
        const telegramService = new TelegramService();
        const result = await telegramService.postToChannel(targetChannel, String(message), {
            parse_mode: 'HTML',
            disable_web_page_preview: false
        });
        
        if (result.ok) {
            logger?.info({ channel: targetChannel, messageId: result.message_id }, '[TOOLS] [post_to_telegram_channel] Message posted');
            return `Message successfully posted to ${targetChannel} (message ID: ${result.message_id})`;
        } else {
            logger?.error({ channel: targetChannel, error: result.description }, '[TOOLS] [post_to_telegram_channel] API error');
            return `Error posting to channel: ${result.description}`;
        }
    } catch (error: any) {
        logger?.error({ channel: targetChannel, error: error.message }, '[TOOLS] [post_to_telegram_channel] Failed');
        return `Error posting to channel "${targetChannel}": ${error.message}`;
    }
}

// Memory tool handlers
async function handleSaveMemory({ content }: ToolArgs, logger?: any, context?: ToolContext): Promise<string> {
    if (!context?.userId || !context?.characterId) {
        return 'Error: missing context for saving memory';
    }
    if (!content) return 'Error: content is required';

    try {
        await memoryService.addMemory(context.userId, context.characterId, String(content), logger);
        logger?.info({ content }, '[TOOLS] [save_memory] Memory saved');
        return `Memory saved successfully: "${String(content).substring(0, 50)}..."`;
    } catch (error: any) {
        logger?.error({ error: error.message }, '[TOOLS] [save_memory] Failed');
        return `Error saving memory: ${error.message}`;
    }
}

async function handleGetMemory({ query, limit }: ToolArgs, logger?: any, context?: ToolContext): Promise<string> {
    if (!context?.userId || !context?.characterId) {
        return 'Error: missing user context for getting memory';
    }
    if (!query) return 'Error: query is required';

    try {
        const memories = await memoryService.searchMemories(
            context.userId, 
            context.characterId, 
            String(query), 
            Number(limit) || 5, 
            logger
        );
        
        if (memories.length === 0) {
            return 'No memories found matching the query.';
        }

        const formatted = memories.map((m, i) => `${i + 1}. ${m.content} (relevance: ${(1 - m.distance).toFixed(2)})`).join('\n');
        logger?.info({ query, count: memories.length }, '[TOOLS] [get_memory] Memories found');
        return `Found ${memories.length} memories:\n${formatted}`;
    } catch (error: any) {
        logger?.error({ error: error.message }, '[TOOLS] [get_memory] Failed');
        return `Error searching memory: ${error.message}`;
    }
}

// Tools Registry
const TOOLS: Record<string, Tool> = {

    create_text_file: {
        enabled: true,
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
        enabled: true,
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
                description: 'Generate image based on prompt',
                parameters: {
                    type: 'object',
                    properties: {
                        prompt: { type: 'string', description: 'Detailed description of the image to generate (Subject, Action, Style, Context). In English.' },
                        aspect_ratio: { type: 'string', enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '16:9', '9:16'], description: 'Aspect ratio', default: '1:1' },
                        provider: { type: 'string', enum: ['xai', 'together'], description: 'AI provider to use', default: 'xai' },
                    },
                    required: ['prompt'],
                },
            },
        },
    },

    save_memory: {
        enabled: true,
        handler: handleSaveMemory,
        definition: {
            type: 'function',
            function: {
                name: 'save_memory',
                description: "Save info to long-term memory, using the user's language.",
                parameters: {
                    type: 'object',
                    properties: {
                        content: { type: 'string', description: 'Info to remember.' },
                    },
                    required: ['content'],
                },
            },
        },
    },

    get_memory: {
        enabled: true,
        handler: handleGetMemory,
        definition: {
            type: 'function',
            function: {
                name: 'get_memory',
                description: "Recall shared memories using the user's language.",
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Topic or specific detail to recall from our past' },
                        limit: { type: 'number', description: 'Max number of memories', default: 5 },
                    },
                    required: ['query'],
                },
            },
        },
    },

    post_to_telegram_channel: {
        enabled: true,
        handler: handlePostToTelegramChannel,
        definition: {
            type: 'function',
            function: {
                name: 'post_to_telegram_channel',
                description: 'Post a message to the Telegram channel. Use for sharing important updates, announcements, or content.',
                parameters: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', description: 'Message to post (HTML formatting supported)' },
                    },
                    required: ['message'],
                },
            },
        },
    },
};

export const ALL_TOOLS: ToolDefinition[] = Object.values(TOOLS)
    .filter(t => t.enabled)
    .map(t => t.definition);

export const IMAGE_TOOLS: ToolDefinition[] = Object.values(TOOLS)
    .filter(t => t.enabled && t.definition.function.name === 'generate_image')
    .map(t => t.definition);

export function getAvailableTools(isAgent: boolean = false): ToolDefinition[] {
    if (isAgent) {
        return ALL_TOOLS;
    } else {
        return IMAGE_TOOLS;
    }
}

export async function executeTool(name: string, argsJson: string, logger?: any, context?: ToolContext): Promise<string> {
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

        const result = await tool.handler(args, logger, context);

        logger?.info({ tool: name, resultLength: result.length }, '[TOOLS] Execution finished');
        return result;
    } catch (err: any) {
        logger?.error({ tool: name, error: err.message, rawArgs: argsJson }, '[TOOLS] Execution error');
        return `Error executing tool "${name}": ${err.message}`;
    }
}
