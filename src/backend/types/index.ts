export interface Character {
  id: number;
  slug: string;
  name: string;
  system_prompt?: string;
  first_message?: string;
  scenario?: string;
  temperature: number;
  max_tokens: number;
  avatar?: string;
  is_agent?: number;
  reasoning?: number;
  created_at?: string;
}

export interface ChatMessage {
  id?: number;
  user_id?: number;
  character_id?: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | any[] | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
  is_greeting?: number;
  timestamp?: string;
}

export interface ChatRequestPayload {
  message: string;
  character_id: number;
  image?: string; // Base64
}

export interface User {
  id: number;
  email: string;
  display_name: string;
  about?: string;
  password?: string;
  created_at?: string;
}
