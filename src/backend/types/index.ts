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
  tools?: number;
  created_at?: string;
}

export interface ChatMessage {
  id?: number;
  user_id?: number;
  character_id?: number;
  role: 'system' | 'user' | 'assistant';
  content: string | any[];
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
  password?: string;
  created_at?: string;
}
