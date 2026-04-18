/* 
 * Base interface for all chat platform adapters
 * Implements the Adapter pattern for different messaging platforms
 * @author Norayr Petrosyan
 * @version 1.0.0
 */

import { ChatMessage, User, Character } from '../types';

export interface ChatAdapter {
  /**
   * Platform identifier (e.g., 'telegram', 'whatsapp', 'discord')
   */
  readonly platform: string;

  /**
   * Send a message to a user on the platform
   */
  sendMessage(userId: string | number, message: string, options?: MessageOptions): Promise<void>;

  /**
   * Handle incoming message from platform
   */
  handleIncomingMessage(payload: any): Promise<void>;

  /**
   * Map platform user to internal user format
   */
  mapPlatformToInternal(platformUser: any): Promise<User | null>;

  /**
   * Map internal user to platform format
   */
  mapInternalToPlatform(internalUser: User): any;

  /**
   * Map platform message to internal message format
   */
  mapPlatformMessageToInternal(platformMessage: any): Promise<ChatMessage | null>;

  /**
   * Get available characters for platform
   */
  getAvailableCharacters(): Promise<Character[]>;

  /**
   * Initialize adapter (setup webhooks, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Check if adapter is properly configured
   */
  isConfigured(): boolean;
}

export interface MessageOptions {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
  replyToMessageId?: string | number;
  keyboard?: any;
  image?: string; // Base64 or URL
}

export interface PlatformUser {
  id: string | number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  isBot?: boolean;
}

export interface PlatformMessage {
  id: string | number;
  userId: string | number;
  text?: string;
  image?: string;
  timestamp: Date;
  metadata?: any;
}
