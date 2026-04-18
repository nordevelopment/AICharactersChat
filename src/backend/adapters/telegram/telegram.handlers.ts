/**
 * Telegram Command Handlers
 * Handles all Telegram bot commands and user interactions
 * @author Norayr Petrosyan
 * @version 1.5.0
 */
import { TelegramMessage, TelegramUser } from './telegram.service';
import { TelegramAdapter } from './telegram.adapter';

export interface CommandHandler {
  command: string;
  description: string;
  handler: (message: TelegramMessage, adapter: TelegramAdapter) => Promise<void>;
}

export class TelegramHandlers {
  private static commands: Map<string, CommandHandler> = new Map([
    ['/start', {
      command: '/start',
      description: 'Show welcome message and get started',
      handler: TelegramHandlers.handleStart
    }],
    ['/help', {
      command: '/help',
      description: 'Show help information and available commands',
      handler: TelegramHandlers.handleHelp
    }],
    ['/characters', {
      command: '/characters',
      description: 'List all available AI characters',
      handler: TelegramHandlers.handleCharacters
    }],
    ['/character', {
      command: '/character [name]',
      description: 'Select a specific AI character',
      handler: TelegramHandlers.handleCharacterSelect
    }],
    ['/reset', {
      command: '/reset',
      description: 'Clear conversation history',
      handler: TelegramHandlers.handleReset
    }],
    ['/status', {
      command: '/status',
      description: 'Show current character and conversation status',
      handler: TelegramHandlers.handleStatus
    }],
    ['/memory', {
      command: '/memory',
      description: 'Show what AI remembers about you',
      handler: TelegramHandlers.handleMemory
    }]
  ]);

  static async handleCommand(message: TelegramMessage, adapter: TelegramAdapter): Promise<void> {
    const text = message.text || '';
    const [command, ...args] = text.split(' ');
    const handler = this.commands.get(command);

    if (handler) {
      try {
        await handler.handler(message, adapter);
      } catch (error) {
        console.error(`[TELEGRAM HANDLERS] Error handling command ${command}:`, error);
        await adapter.sendMessage(
          message.chat.id,
          'Sorry, I encountered an error processing that command. Please try again.'
        );
      }
    } else {
      await adapter.sendMessage(
        message.chat.id,
        `Unknown command: ${command}\n\nUse /help to see available commands.`
      );
    }
  }

  static getAvailableCommands(): CommandHandler[] {
    return Array.from(this.commands.values());
  }

  private static async handleStart(message: TelegramMessage, adapter: TelegramAdapter): Promise<void> {
    const user = message.from;
    const welcomeMessage = `
<b>Welcome to AI Character Chat! ${user?.first_name || 'User'}${user?.last_name ? ' ' + user.last_name : ''}</b> ${user?.username ? `(@${user.username})` : ''}

I'm your AI companion bot. You can chat with various AI characters here.

<b>Quick Start:</b>
1. Send any message to start chatting with your current character
2. Use /characters to see all available characters
3. Use /character [name] to switch characters

<b>Available Commands:</b>
${this.getCommandList()}

<b>Features:</b>
- Multiple AI personalities
- Long-term memory (AI remembers important facts)
- Image analysis (send photos to discuss)
- Voice messages (if enabled)

<b>Tips:</b>
- Use "Remember: [fact]" to save important information
- AI maintains context across conversations
- Switch characters anytime without losing history

Ready to chat? Just send me a message!`;

    await adapter.sendMessage(message.chat.id, welcomeMessage);
  }

  private static async handleHelp(message: TelegramMessage, adapter: TelegramAdapter): Promise<void> {
    const helpMessage = `
<b>AI Character Chat Help</b>

<b>Commands:</b>
${this.getCommandList()}

<b>Character Management:</b>
- Each character has unique personality and knowledge
- Switch characters anytime with /character
- Conversation history is preserved per character

<b>Memory System:</b>
- AI remembers important facts across conversations
- Use "Remember: [fact]" to explicitly save information
- Use /memory to see what AI remembers

<b>Message Types:</b>
- Text messages for regular conversation
- Images for visual analysis and discussion
- Voice messages (if enabled by admin)

<b>Getting Help:</b>
- Use /status to see current character
- Use /reset to clear conversation if needed
- Reply to any message for context

<b>Privacy:</b>
- Your conversations are private
- Memory is personal to your account
- No data is shared with other users

Need more help? Just ask me anything!`;

    await adapter.sendMessage(message.chat.id, helpMessage);
  }

  private static async handleCharacters(message: TelegramMessage, adapter: TelegramAdapter): Promise<void> {
    try {
      const characters = await adapter.getAvailableCharacters();
      
      if (characters.length === 0) {
        await adapter.sendMessage(
          message.chat.id,
          'No characters are currently available. Please contact the administrator.'
        );
        return;
      }

      let messageText = `<b>Available AI Characters (${characters.length}):</b>\n\n`;
      
      characters.forEach((character, index) => {
        messageText += `${index + 1}. <b>${character.name}</b>\n`;
        
        if (character.scenario) {
          // Truncate long scenarios
          const scenario = character.scenario.length > 100 
            ? character.scenario.substring(0, 100) + '...' 
            : character.scenario;
          messageText += `   ${scenario}\n`;
        }
        
        messageText += `   /character ${character.name.toLowerCase()}\n\n`;
      });

      messageText += `<b>How to select:</b>\nUse /character [name] or click the character name above`;

      await adapter.sendMessage(message.chat.id, messageText);
    } catch (error) {
      console.error('[TELEGRAM HANDLERS] Error fetching characters:', error);
      await adapter.sendMessage(
        message.chat.id,
        'Failed to load characters. Please try again later.'
      );
    }
  }

  private static async handleCharacterSelect(message: TelegramMessage, adapter: TelegramAdapter): Promise<void> {
    const text = message.text || '';
    const args = text.split(' ').slice(1);
    
    if (args.length === 0) {
      await adapter.sendMessage(
        message.chat.id,
        'Please specify a character name. Example: /character [name]\n\nUse /characters to see available characters.'
      );
      return;
    }

    const characterName = args.join(' ').toLowerCase();
    
    try {
      const characters = await adapter.getAvailableCharacters();
      const character = characters.find(c => 
        c.name.toLowerCase() === characterName ||
        c.name.toLowerCase().includes(characterName)
      );

      if (!character) {
        await adapter.sendMessage(
          message.chat.id,
          `Character "${args.join(' ')}" not found.\n\nUse /characters to see available characters.`
        );
        return;
      }

      // Set character for user (this would be handled by the adapter)
      await adapter['setUserCharacter'](message.from.id, character.id!);
      
      const responseMessage = `
<b>Character switched to: ${character.name}</b>

${character.first_message || 'Hello! I\'m ready to chat with you.'}

${character.scenario ? `\n<b>Scenario:</b> ${character.scenario}` : ''}

You can now start chatting with ${character.name}!`;

      await adapter.sendMessage(message.chat.id, responseMessage);
    } catch (error) {
      console.error('[TELEGRAM HANDLERS] Error selecting character:', error);
      await adapter.sendMessage(
        message.chat.id,
        'Failed to select character. Please try again.'
      );
    }
  }

  private static async handleReset(message: TelegramMessage, adapter: TelegramAdapter): Promise<void> {
    const confirmMessage = `
<b>Reset Conversation?</b>

This will clear your entire conversation history with the current character, but the AI will still remember important facts about you.

Type "confirm reset" to proceed, or "cancel" to abort.

<b>Note:</b> This action cannot be undone.`;

    await adapter.sendMessage(message.chat.id, confirmMessage);
    
    // In a real implementation, you'd wait for the user's confirmation
    // For now, we'll implement a simple timeout-based confirmation
  }

  private static async handleStatus(message: TelegramMessage, adapter: TelegramAdapter): Promise<void> {
    try {
      const characters = await adapter.getAvailableCharacters();
      const currentCharacterId = await adapter['getUserCharacter'](message.from.id);
      const currentCharacter = characters.find(c => c.id === currentCharacterId);
      
      let statusMessage = `<b>Chat Status</b>\n\n`;
      
      if (currentCharacter) {
        statusMessage += `<b>Current Character:</b> ${currentCharacter.name}\n`;
        statusMessage += `<b>Description:</b> ${currentCharacter.scenario || 'No description'}\n\n`;
      } else {
        statusMessage += `<b>Current Character:</b> Not selected\n\n`;
      }
      
      statusMessage += `<b>Total Available Characters:</b> ${characters.length}\n`;
      statusMessage += `<b>User ID:</b> ${message.from.id}\n`;
      statusMessage += `<b>Username:</b> @${message.from.username || 'N/A'}\n`;
      
      await adapter.sendMessage(message.chat.id, statusMessage);
    } catch (error) {
      console.error('[TELEGRAM HANDLERS] Error getting status:', error);
      await adapter.sendMessage(
        message.chat.id,
        'Failed to get status. Please try again.'
      );
    }
  }

  private static async handleMemory(message: TelegramMessage, adapter: TelegramAdapter): Promise<void> {
    try {
      // This would integrate with the memory service
      const memoryMessage = `
<b>Memory System</b>

The AI remembers important facts about you across conversations. This helps provide personalized responses.

<b>What gets remembered:</b>
- Important personal details you share
- Preferences and interests
- Context from ongoing conversations
- Facts you explicitly ask to remember

<b>How to add memories:</b>
- Say "Remember: [fact]" during conversation
- Share personal information naturally
- The AI automatically extracts important details

<b>Privacy:</b>
- Your memories are private to your account
- No data is shared with other users
- You can request memory deletion if needed

<b>Current status:</b>
Memory system is active and learning from your conversations.

Want to see specific memories? Just ask "What do you remember about me?" during chat!`;

      await adapter.sendMessage(message.chat.id, memoryMessage);
    } catch (error) {
      console.error('[TELEGRAM HANDLERS] Error showing memory info:', error);
      await adapter.sendMessage(
        message.chat.id,
        'Failed to retrieve memory information.'
      );
    }
  }

  private static getCommandList(): string {
    return this.getAvailableCommands()
      .map(cmd => `/${cmd.command.replace('/', '')} - ${cmd.description}`)
      .join('\n');
  }
}
