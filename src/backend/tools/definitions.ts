/**
 * Tool Definitions — описания инструментов для OpenAI-совместимого API.
 * Это то, что видит модель. Добавляй новые инструменты сюда.
 *
 * Формат: https://openrouter.ai/docs/guides/features/tool-calling
 */

export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, {
                type: string;
                description: string;
                enum?: string[];
                default?: string | number | boolean;
            }>;
            required: string[];
        };
    };
}

const createTextFileTool: ToolDefinition = {
    type: 'function',
    function: {
        name: 'create_text_file',
        description: 'Write content to a file. User provides filename and content, or you can suggest them.',
        parameters: {
            type: 'object',
            properties: {
                filename: {
                    type: 'string',
                    description: 'File name (you can suggest appropriate name)',
                },
                content: {
                    type: 'string',
                    description: 'Text content to write (user provides or you create)',
                },
            },
            required: ['filename', 'content'],
        },
    },
};

const readTextFileTool: ToolDefinition = {
    type: 'function',
    function: {
        name: 'read_text_file',
        description:
            'Reads the content of a text file from the sandbox by its filename. ' +
            'Use this when the user asks to open, read, or show the contents of a file.',
        parameters: {
            type: 'object',
            properties: {
                filename: {
                    type: 'string',
                    description: 'File Name to read. Example: "my_note.txt".',
                },
            },
            required: ['filename'],
        },
    },
};


const generateImageTool: ToolDefinition = {
    type: 'function',
    function: {
        name: 'generate_image',
        description:
            'Generates an image using AI (FLUX2.dev model) based on a text prompt. ' +
            'Returns a URL path to the generated image.',
        parameters: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'Detailed description of the image to generate.'
                },
                aspect_ratio: {
                    type: 'string',
                    enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '16:9', '9:16'],
                    description: 'Aspect ratio of the generated image',
                    default: '1:1',
                },
            },
            required: ['prompt'],
        },
    },
};

export const ALL_TOOLS: ToolDefinition[] = [
    createTextFileTool,
    readTextFileTool,
    generateImageTool,
    // searchWebTool,
];
