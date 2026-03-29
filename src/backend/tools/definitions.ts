/**
 * Tool Definitions
 * Format: https://openrouter.ai/docs/guides/features/tool-calling
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
            'Reads the content of a text plain file by filename.',
        parameters: {
            type: 'object',
            properties: {
                filename: {
                    type: 'string',
                    description: 'File name to read. Example: "my_note.txt".',
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
            'Generates an AI image (FLUX model) from a text prompt. Returns a image url.',
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
                    description: 'Aspect ratios',
                    default: '1:1',
                },
            },
            required: ['prompt'],
        },
    },
};

/**
 * Tool Definitions registry.
 * Add new tools here.
 */
export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
    create_text_file: createTextFileTool,
    read_text_file: readTextFileTool,
    generate_image: generateImageTool,
};

/**
 * CONFIG: Список инструментов, которые разрешено передавать в ИИ.
 * Просто закомментируй или удали то, что не нужно.
 */
export const ENABLED_TOOLS_LIST = [
    'generate_image',
    // 'create_text_file',
    // 'read_text_file',
];

/**
 * Filtered list of tools based on ENABLED_TOOLS_LIST.
 * This is what ai.service.ts uses.
 */
export const ALL_TOOLS: ToolDefinition[] = ENABLED_TOOLS_LIST
    .map(name => TOOL_REGISTRY[name])
    .filter(Boolean);
