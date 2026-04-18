/**
 * Telegram Adapter for AI Character Chat
 * Implements the ChatAdapter interface for Telegram platform
 * 
 * @author Norayr Petrosyan
 * @version 1.5.0
 */
import { ChatAdapter, MessageOptions, PlatformUser, PlatformMessage } from '../chat.adapter.interface';
import { ChatMessage, User, Character } from '../../types';
import { TelegramService, TelegramMessage, TelegramUser } from './telegram.service';
import { telegramConfig } from './telegram.config';
import { getDB } from '../../database/sqlite';
import { aiService } from '../../services/ai.service';
import { User as UserModel } from '../../models/User';
import { Character as CharacterModel } from '../../models/Character';
import { Message as MessageModel } from '../../models/Message';
import axios from 'axios';

export class TelegramAdapter implements ChatAdapter {
  readonly platform = 'telegram';
  
  private userCharacterMap: Map<number, number> = new Map(); // telegramUserId -> characterId
  
  constructor(
    private telegramService: TelegramService,
    private logger?: any
  ) {}

  async initialize(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Telegram adapter is not properly configured');
    }

    try {
      // Test bot connection
      const botInfo = await this.telegramService.getMe();
      this.logger?.info({ botInfo: { id: botInfo.id, username: botInfo.username, first_name: botInfo.first_name } }, '[TELEGRAM ADAPTER] Bot initialized successfully');

      // Set webhook if configured
      if (telegramConfig.webhookUrl) {
        await this.telegramService.setWebhook(telegramConfig.webhookUrl, telegramConfig.webhookSecret);
        this.logger?.info({ webhookUrl: telegramConfig.webhookUrl }, '[TELEGRAM ADAPTER] Webhook set');
      }

      // Initialize default character mapping
      if (telegramConfig.defaultCharacterId) {
        // We'll set this when users start chatting
      }

    } catch (error) {
      this.logger?.error({ error }, '[TELEGRAM ADAPTER] Failed to initialize');
      throw error;
    }
  }

  isConfigured(): boolean {
    return telegramConfig.validateConfig();
  }

  async sendMessage(userId: string | number, message: string, options?: MessageOptions): Promise<void> {
    try {
      const chatId = typeof userId === 'string' ? parseInt(userId) : userId;
      
      // Send typing action first if enabled
      if (telegramConfig.typingSimulation) {
        await this.telegramService.sendChatAction(chatId, 'typing');
        // Small delay to simulate typing
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Split long messages
      const messages = this.splitMessage(message, telegramConfig.maxMessageLength);
      
      for (const msg of messages) {
        const payload: any = {
          chat_id: chatId,
          text: msg,
          parse_mode: options?.parseMode || 'HTML',
          disable_web_page_preview: options?.disableWebPagePreview,
          disable_notification: options?.disableNotification,
        };

        if (options?.replyToMessageId) {
          payload.reply_to_message_id = options.replyToMessageId;
        }

        if (options?.keyboard) {
          payload.reply_markup = options.keyboard;
        }

        await this.telegramService.sendMessage(payload);
      }

    } catch (error) {
      this.logger?.error({ userId, error }, '[TELEGRAM ADAPTER] Failed to send message');
      throw error;
    }
  }

  async handleIncomingMessage(payload: any): Promise<void> {
    try {
      if (payload.message) {
        await this.handleMessage(payload.message);
      } else if (payload.callback_query) {
        await this.handleCallbackQuery(payload.callback_query);
      } else if (payload.inline_query) {
        await this.handleInlineQuery(payload.inline_query);
      }
    } catch (error) {
      this.logger?.error({ payload, error }, '[TELEGRAM ADAPTER] Failed to handle incoming message');
    }
  }

  private async handleMessage(telegramMessage: TelegramMessage): Promise<void> {
    const { from: telegramUser, chat, text } = telegramMessage;

    // Check if user is allowed
    if (!this.telegramService.isUserAllowed(telegramUser.id)) {
      this.logger?.warn({ userId: telegramUser.id }, '[TELEGRAM ADAPTER] Unauthorized user attempt');
      await this.telegramService.sendMessage({
        chat_id: chat.id,
        text: 'Sorry, you are not authorized to use this bot.'
      });
      return;
    }

    // Handle commands
    if (text && text.startsWith('/')) {
      await this.handleCommand(telegramMessage);
      return;
    }

    // Handle regular message (text or photo)
    if (text || telegramMessage.photo) {
      await this.handleTextMessage(telegramMessage);
    }
  }

  private async handleCommand(telegramMessage: TelegramMessage): Promise<void> {
    const { chat, text, from } = telegramMessage;
    const command = text!.split(' ')[0].toLowerCase();
    const args = text!.split(' ').slice(1);

    switch (command) {
      case '/start':
        await this.handleStartCommand(chat.id, from);
        break;
      case '/help':
        await this.handleHelpCommand(chat.id);
        break;
      case '/characters':
        await this.handleCharactersCommand(chat.id, from.id);
        break;
      case '/character':
        await this.handleCharacterCommand(chat.id, from.id, args);
        break;
      case '/reset':
        await this.handleResetCommand(chat.id, from.id);
        break;
      // case '/post':
      //   await this.handlePostCommand(chat.id, from.id, args);
      //   break;
      default:
        await this.telegramService.sendMessage({
          chat_id: chat.id,
          text: 'Unknown command. Use /help to see available commands.'
        });
    }
  }

  private async handleStartCommand(chatId: number, user: TelegramUser): Promise<void> {
    const welcomeMessage = `
<b>Welcome to AI Character Chat! ${user.first_name}</b>

I'm your AI companion bot. You can chat with various AI characters here.

<b>Available commands:</b>
/start - Show this welcome message
/help - Show help information
/characters - List available characters
/character [name] - Select a character
/reset - Reset conversation history

<b>Getting started:</b>
1. Type /characters to see available characters
2. Type /character [name] to select a character
3. Start chatting!

Your default character is already set. Just send a message to begin!`;

    await this.telegramService.sendMessage({
      chat_id: chatId,
      text: welcomeMessage,
      parse_mode: 'HTML'
    });
  }

  private async handleHelpCommand(chatId: number): Promise<void> {
    const helpMessage = `
<b>AI Character Chat Help</b>

<b>Commands:</b>
/start - Welcome message
/characters - List all available characters
/character [name] - Select specific character
/reset - Clear conversation history
/post [channel] message - Post message to channel (admin only)
/help - Show this help

<b>Features:</b>
- Chat with multiple AI characters
- Long-term memory (AI remembers important facts)
- Image support (send images to analyze)
- Voice messages (if enabled)
- Channel posting (admin only)

<b>Tips:</b>
- Use "Remember: [fact]" to save important information
- AI will remember details across conversations
- Switch characters anytime with /character command
- Use /post to share AI responses or announcements to channels`;

    await this.telegramService.sendMessage({
      chat_id: chatId,
      text: helpMessage,
      parse_mode: 'HTML'
    });
  }

  private async handleCharactersCommand(chatId: number, userId: number): Promise<void> {
    try {
      const characters = await this.getAvailableCharacters();
      
      if (characters.length === 0) {
        await this.telegramService.sendMessage({
          chat_id: chatId,
          text: 'No characters available. Please contact admin.'
        });
        return;
      }

      let message = '<b>Available Characters:</b>\n\n';
      const buttons: { text: string; callback_data: string }[] = [];

      characters.forEach((character, index) => {
        message += `${index + 1}. <b>${character.name}</b>\n`;
        if (character.scenario) {
          message += `   ${character.scenario}\n`;
        }
        message += '\n';
        
        buttons.push({
          text: character.name,
          callback_data: `select_character_${character.id}`
        });
      });

      const keyboard = this.telegramService.createInlineKeyboard(buttons);

      await this.telegramService.sendMessage({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } catch (error) {
      this.logger?.error({ error }, '[TELEGRAM ADAPTER] Failed to get characters');
      await this.telegramService.sendMessage({
        chat_id: chatId,
        text: 'Failed to load characters. Please try again later.'
      });
    }
  }

  private async handleCharacterCommand(chatId: number, userId: number, args: string[]): Promise<void> {
    if (args.length === 0) {
      await this.telegramService.sendMessage({
        chat_id: chatId,
        text: 'Please specify a character name. Use /characters to see available characters.'
      });
      return;
    }

    const characterName = args.join(' ').toLowerCase();
    try {
      const characters = await this.getAvailableCharacters();
      const character = characters.find(c => c.name.toLowerCase() === characterName);

      if (!character) {
        await this.telegramService.sendMessage({
          chat_id: chatId,
          text: `Character "${args.join(' ')}" not found. Use /characters to see available characters.`
        });
        return;
      }

      this.userCharacterMap.set(userId, character.id!);
      
      await this.telegramService.sendMessage({
        chat_id: chatId,
        text: `Character switched to <b>${character.name}</b>\n\n${character.first_message || 'Start chatting!'}`,
        parse_mode: 'HTML'
      });
    } catch (error) {
      this.logger?.error({ error, characterName }, '[TELEGRAM ADAPTER] Failed to select character');
      await this.telegramService.sendMessage({
        chat_id: chatId,
        text: 'Failed to select character. Please try again.'
      });
    }
  }

  private async handleResetCommand(chatId: number, userId: number): Promise<void> {
    try {
      // Get current character
      const characterId = this.userCharacterMap.get(userId) || telegramConfig.defaultCharacterId;
      
      // Clear message history
      const internalUser = await this.getOrCreateInternalUser(userId);
      if (internalUser) {
        MessageModel.deleteHistory(characterId, internalUser.id);
      }

      await this.telegramService.sendMessage({
        chat_id: chatId,
        text: 'Conversation history has been reset. You can start fresh!'
      });
    } catch (error) {
      this.logger?.error({ error }, '[TELEGRAM ADAPTER] Failed to reset conversation');
      await this.telegramService.sendMessage({
        chat_id: chatId,
        text: 'Failed to reset conversation. Please try again.'
      });
    }
  }

  private async handlePostCommand(chatId: number, userId: number, args: string[]): Promise<void> {
    // Check if user is admin
    if (!this.telegramService.isUserAdmin(userId)) {
      await this.telegramService.sendMessage({
        chat_id: chatId,
        text: 'Sorry, only admins can use the /post command.'
      });
      return;
    }

    if (args.length === 0) {
      await this.telegramService.sendMessage({
        chat_id: chatId,
        text: `Usage: /post [channel] message\n\nExample: /post @mychannel Hello everyone!\nOr: /post Hello everyone! (uses default channel)`
      });
      return;
    }

    try {
      // Check if first argument is a channel (starts with @ or is numeric)
      let channel: string | undefined;
      let messageStartIndex = 0;

      if (args[0].startsWith('@') || /^\d+$/.test(args[0])) {
        channel = args[0];
        messageStartIndex = 1;
      }

      // Join remaining arguments as message
      const message = args.slice(messageStartIndex).join(' ');
      
      if (!message) {
        await this.telegramService.sendMessage({
          chat_id: chatId,
          text: 'Error: message cannot be empty'
        });
        return;
      }

      // Use configured channel if none specified
      const targetChannel = channel || telegramConfig.channel;
      
      if (!targetChannel) {
        await this.telegramService.sendMessage({
          chat_id: chatId,
          text: 'Error: no channel specified and no default channel configured'
        });
        return;
      }

      // Check if channel is allowed
      if (!telegramConfig.isChannelAllowed(targetChannel)) {
        await this.telegramService.sendMessage({
          chat_id: chatId,
          text: `Error: channel "${targetChannel}" is not in the allowed channels list`
        });
        return;
      }

      // Post to channel
      const result = await this.telegramService.postToChannel(targetChannel, message, {
        parse_mode: 'HTML'
      });

      if (result.ok) {
        await this.telegramService.sendMessage({
          chat_id: chatId,
          text: `Message successfully posted to ${targetChannel} (message ID: ${result.message_id})`
        });
      } else {
        await this.telegramService.sendMessage({
          chat_id: chatId,
          text: `Error posting to channel: ${result.description}`
        });
      }

    } catch (error) {
      this.logger?.error({ error, userId }, '[TELEGRAM ADAPTER] Failed to post to channel');
      await this.telegramService.sendMessage({
        chat_id: chatId,
        text: 'Failed to post to channel. Please check the channel identifier and try again.'
      });
    }
  }

  private async handleTextMessage(telegramMessage: TelegramMessage): Promise<void> {
    const { chat, from, text, photo, caption } = telegramMessage;
    const messageText = text || caption || (photo ? "" : undefined);
    
    if (messageText === undefined) return;

    try {
      // Get or create internal user
      const internalUser = await this.getOrCreateInternalUser(from.id);
      if (!internalUser) {
        await this.telegramService.sendMessage({
          chat_id: chat.id,
          text: 'Failed to authenticate. Please try /start again.'
        });
        return;
      }

      // Get character for this user
      const characterId = this.userCharacterMap.get(from.id) || telegramConfig.defaultCharacterId;
      const character = CharacterModel.findById(characterId);
      
      if (!character) {
        await this.telegramService.sendMessage({
          chat_id: chat.id,
          text: 'Character not found. Please use /characters to select one.'
        });
        return;
      }

      let imageBase64: string | undefined;
      
      // Process photo if present
      if (photo && photo.length > 0) {
        try {
          // Send typing action to show we are processing image
          await this.telegramService.sendChatAction(chat.id, 'upload_photo');
          
          // Get the largest photo (last in the array)
          const largestPhoto = photo[photo.length - 1];
          const fileInfo = await this.telegramService.getFile(largestPhoto.file_id);
          
          if (fileInfo && fileInfo.file_path) {
            const buffer = await this.telegramService.downloadFile(fileInfo.file_path);
            imageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
            this.logger?.info({ userId: from.id, charId: characterId }, '[TELEGRAM ADAPTER] Image downloaded and converted to base64');
          }
        } catch (err: any) {
          this.logger?.error({ error: err.message }, '[TELEGRAM ADAPTER] Image processing failed');
          // We continue without the image if processing fails, the text might still be useful
        }
      }

      // Process message through AI service
      let response = '';
      for await (const chunk of aiService.streamChatResponse(character, internalUser.id, messageText, imageBase64, this.logger)) {
        if (chunk && chunk.reply) {
          response += chunk.reply;
        }
      }
      
      // Send response back to Telegram
      if (response) {
        await this.sendMessage(chat.id, response);
      }

    } catch (error) {
      this.logger?.error({ error, userId: from.id }, '[TELEGRAM ADAPTER] Failed to process message');
      await this.telegramService.sendMessage({
        chat_id: chat.id,
        text: 'Sorry, I encountered an error processing your message. Please try again.'
      });
    }
  }

  private async handleCallbackQuery(callbackQuery: any): Promise<void> {
    const { id, from, message, data } = callbackQuery;
    
    try {
      // Acknowledge callback
      await this.telegramService.answerCallbackQuery(id);

      if (data.startsWith('select_character_')) {
        const characterId = parseInt(data.replace('select_character_', ''));
        const character = CharacterModel.findById(characterId);
        
        if (character) {
          this.userCharacterMap.set(from.id, characterId);
          
          await this.telegramService.sendMessage({
            chat_id: message.chat.id,
            text: `Character switched to <b>${character.name}</b>\n\n${character.first_message || 'Start chatting!'}`,
            parse_mode: 'HTML'
          });
        }
      }
    } catch (error) {
      this.logger?.error({ error, callbackQuery: data }, '[TELEGRAM ADAPTER] Failed to handle callback query');
    }
  }

  private async handleInlineQuery(inlineQuery: any): Promise<void> {
    // TODO: Implement inline mode for character selection
    this.logger?.info({ inlineQuery }, '[TELEGRAM ADAPTER] Inline query received');
  }


  private async getOrCreateInternalUser(telegramUserId: number): Promise<User | null> {
    try {
      // Try to find existing user by telegram_id (we'd need to add this field to users table)
      // For now, we'll create a simple mapping
      
      let user = UserModel.findByEmail(`telegram_${telegramUserId}@bot.local`);
      
      if (!user) {
        // Create new user
        // Create user directly via SQL since User.create doesn't exist
        const db = getDB();
        const stmt = db.prepare('INSERT INTO users (email, password, display_name) VALUES (?, ?, ?)');
        stmt.run(`telegram_${telegramUserId}@bot.local`, 'telegram_bot_user', `Telegram User ${telegramUserId}`);
        user = UserModel.findByEmail(`telegram_${telegramUserId}@bot.local`);
      }

      return user || null;
    } catch (error) {
      this.logger?.error({ error, telegramUserId }, '[TELEGRAM ADAPTER] Failed to get/create internal user');
      return null;
    }
  }

  private splitMessage(message: string, maxLength: number): string[] {
    if (message.length <= maxLength) return [message];
    
    const messages: string[] = [];
    let currentMessage = '';
    
    const words = message.split(' ');
    for (const word of words) {
      if (currentMessage.length + word.length + 1 > maxLength) {
        messages.push(currentMessage.trim());
        currentMessage = word;
      } else {
        currentMessage += (currentMessage ? ' ' : '') + word;
      }
    }
    
    if (currentMessage.trim()) {
      messages.push(currentMessage.trim());
    }
    
    return messages;
  }

  async mapPlatformToInternal(platformUser: TelegramUser): Promise<User | null> {
    return this.getOrCreateInternalUser(platformUser.id);
  }

  mapInternalToPlatform(internalUser: User): any {
    return {
      id: internalUser.id,
      email: internalUser.email,
      display_name: internalUser.display_name
    };
  }

  async mapPlatformMessageToInternal(platformMessage: TelegramMessage): Promise<ChatMessage | null> {
    const internalUser = await this.getOrCreateInternalUser(platformMessage.from.id);
    if (!internalUser) return null;

    const characterId = this.userCharacterMap.get(platformMessage.from.id) || telegramConfig.defaultCharacterId;

    return {
      user_id: internalUser.id,
      character_id: characterId,
      role: 'user',
      content: platformMessage.text || '',
      timestamp: new Date(platformMessage.date * 1000).toISOString()
    };
  }

  async getAvailableCharacters(): Promise<Character[]> {
    return CharacterModel.all();
  }

  /**
   * Set character for user
   */
  setUserCharacter(telegramUserId: number, characterId: number): void {
    this.userCharacterMap.set(telegramUserId, characterId);
    this.logger?.info({ telegramUserId, characterId }, '[TELEGRAM ADAPTER] User character set');
  }

  /**
   * Get character for user
   */
  getUserCharacter(telegramUserId: number): number | undefined {
    return this.userCharacterMap.get(telegramUserId);
  }
}
