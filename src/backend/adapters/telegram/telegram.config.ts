/**
 * Telegram Configuration
 * @author Norayr Petrosyan
 * @version 1.5.0
 */
import { config } from '../../config/config';

export const telegramConfig = {
  // Bot configuration
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  
  // Webhook configuration
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || `${config.apiUrl}/webhook/telegram`,
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  
  // Security
  allowedUsers: process.env.TELEGRAM_ALLOWED_USERS?.split(',').map(id => id.trim()) || [],
  adminUsers: process.env.TELEGRAM_ADMIN_USERS?.split(',').map(id => id.trim()) || [],
  
  // Channel configuration
  channel: process.env.TELEGRAM_CHANNEL || '',
  
  // Features (simplified - always enabled by default)
  enableImages: process.env.TELEGRAM_ENABLE_IMAGES === 'true', // Disabled by default for security
  enableVoiceMessages: process.env.TELEGRAM_ENABLE_VOICE === 'true', // Disabled by default
  
  // Message settings
  maxMessageLength: parseInt(process.env.TELEGRAM_MAX_MESSAGE_LENGTH || '4000', 10),
  typingSimulation: true, // Always enabled
  
  // Character selection
  enableCharacterSwitch: process.env.TELEGRAM_ENABLE_CHARACTER_SWITCH !== 'false', // Always enabled
  defaultCharacterId: parseInt(process.env.TELEGRAM_DEFAULT_CHARACTER_ID || '1', 10),
  
  // Rate limiting
  rateLimitPerUser: parseInt(process.env.TELEGRAM_RATE_LIMIT_PER_USER || '30', 10),
  rateLimitWindow: parseInt(process.env.TELEGRAM_RATE_LIMIT_WINDOW || '60', 10), // seconds
  
  // Logging
  enableLogging: process.env.TELEGRAM_ENABLE_LOGGING !== 'false',
  
  // Validation
  validateConfig(): boolean {
    if (!this.botToken) {
      console.error('[TELEGRAM CONFIG] Bot token is required');
      return false;
    }
    
    if (this.allowedUsers.length > 0) {
      console.info('[TELEGRAM CONFIG] Access restricted to allowed users:', this.allowedUsers.length);
    }
    
    if (this.channel) {
      console.info('[TELEGRAM CONFIG] Channel configured:', this.channel);
    }
    
    return true;
  },

  /**
   * Check if channel is allowed for posting
   */
  isChannelAllowed(channelIdentifier: string): boolean {
    // If no channel configured, no posting allowed
    if (!this.channel) return false;
    
    // Normalize channel identifier (case-insensitive)
    const normalizedChannel = channelIdentifier.toLowerCase();
    const configuredChannel = this.channel.toLowerCase();
    
    // Check if matches configured channel
    return normalizedChannel === configuredChannel ||
           normalizedChannel === (configuredChannel.startsWith('@') ? configuredChannel : `@${configuredChannel}`) ||
           configuredChannel === (normalizedChannel.startsWith('@') ? normalizedChannel : `@${normalizedChannel}`);
  }
};
