import axios, { AxiosResponse } from 'axios';
import { telegramConfig } from './telegram.config';

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: any[];
  voice?: any;
  caption?: string;
  reply_to_message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: any;
  inline_query?: any;
}

export interface SendMessagePayload {
  chat_id: number | string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: any;
}

export interface SendPhotoPayload {
  chat_id: number | string;
  photo: string; // file_id or URL or base64
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: any;
}

export class TelegramService {
  private readonly baseUrl: string;
  private readonly botToken: string;

  constructor() {
    this.botToken = telegramConfig.botToken;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Send a text message
   */
  async sendMessage(payload: SendMessagePayload): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, payload);
      return response.data;
    } catch (error) {
      console.error('[TELEGRAM SERVICE] Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Send a photo
   */
  async sendPhoto(payload: SendPhotoPayload): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/sendPhoto`, payload);
      return response.data;
    } catch (error) {
      console.error('[TELEGRAM SERVICE] Failed to send photo:', error);
      throw error;
    }
  }

  /**
   * Send "typing" action to show bot is processing
   */
  async sendChatAction(chatId: number | string, action: 'typing' | 'upload_photo' = 'typing'): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/sendChatAction`, {
        chat_id: chatId,
        action: action
      });
    } catch (error) {
      console.error('[TELEGRAM SERVICE] Failed to send chat action:', error);
    }
  }

  /**
   * Get bot information
   */
  async getMe(): Promise<TelegramUser> {
    try {
      const response = await axios.get(`${this.baseUrl}/getMe`);
      return response.data.result;
    } catch (error) {
      console.error('[TELEGRAM SERVICE] Failed to get bot info:', error);
      throw error;
    }
  }

  /**
   * Set webhook for receiving updates
   */
  async setWebhook(webhookUrl: string, secretToken?: string): Promise<any> {
    try {
      const payload: any = { url: webhookUrl };
      if (secretToken) {
        payload.secret_token = secretToken;
      }
      const response = await axios.post(`${this.baseUrl}/setWebhook`, payload);
      return response.data;
    } catch (error) {
      console.error('[TELEGRAM SERVICE] Failed to set webhook:', error);
      throw error;
    }
  }

  /**
   * Get current webhook info
   */
  async getWebhookInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/getWebhookInfo`);
      return response.data.result;
    } catch (error) {
      console.error('[TELEGRAM SERVICE] Failed to get webhook info:', error);
      throw error;
    }
  }

  /**
   * Delete webhook (switch back to getUpdates)
   */
  async deleteWebhook(): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/deleteWebhook`);
      return response.data;
    } catch (error) {
      console.error('[TELEGRAM SERVICE] Failed to delete webhook:', error);
      throw error;
    }
  }

  /**
   * Create inline keyboard
   */
  createInlineKeyboard(buttons: Array<{ text: string; callback_data: string }>): any {
    return {
      inline_keyboard: buttons.map(button => [button])
    };
  }

  /**
   * Create reply keyboard
   */
  createReplyKeyboard(buttons: string[][], resize_keyboard: boolean = true, one_time_keyboard: boolean = false): any {
    return {
      keyboard: buttons,
      resize_keyboard: resize_keyboard,
      one_time_keyboard: one_time_keyboard
    };
  }

  /**
   * Validate webhook request (if secret token is set)
   */
  validateWebhookRequest(secretToken: string, requestHeaders: any): boolean {
    if (!telegramConfig.webhookSecret) return true;
    
    const headerToken = requestHeaders['x-telegram-bot-api-secret-token'];
    return headerToken === telegramConfig.webhookSecret;
  }

  /**
   * Check if user is allowed
   */
  isUserAllowed(userId: number): boolean {
    // If no allowed users specified, allow everyone
    if (telegramConfig.allowedUsers.length === 0) return true;
    // Otherwise check against allowed users list
    return telegramConfig.allowedUsers.includes(userId.toString());
  }

  /**
   * Check if user is admin
   */
  isUserAdmin(userId: number): boolean {
    return telegramConfig.adminUsers.includes(userId.toString());
  }

  /**
   * Answer callback query
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert: boolean = false): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: showAlert
      });
      return response.data;
    } catch (error) {
      console.error('[TELEGRAM SERVICE] Failed to answer callback query:', error);
      throw error;
    }
  }
}
