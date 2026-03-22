import axios from 'axios';
import sharp from 'sharp';
import { config } from '../config/config';
import { dbRepo } from '../database/sqlite';
import { Character, ChatMessage } from '../types';

/**
 * Типизация для OpenAI-совместимых сообщений
 */
interface AiContentItem {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AiContentItem[];
}

export class AiService {
  /**
   * Суммаризация старых сообщений, чтобы не раздувать контекст.
   * Вызывается при достижении лимита.
   */
  async summarizeIfNeeded(characterId: number, userId: number): Promise<void> {
    const history = await dbRepo.getChatMessages(characterId, userId);

    // Если сообщений меньше 30, не мучаем API
    if (history.length <= 30) return;

    // Берем первые 15 сообщений для суммаризации
    // (оставляем запас свежих сообщений в истории)
    const messagesToSummarize = history.slice(0, 15);
    const idsToDelete = messagesToSummarize.filter(m => m.id).map(m => m.id!);

    try {
      const prompt = 'You are a history chronologist. Briefly summarize the previous interaction context of the following dialogue in one concise paragraph:';

      const res = await axios.post(config.apiUrl, {
        model: config.aiDefaultModel,
        temperature: 0.4, // Для суммаризации лучше поменьше креатива
        max_tokens: 250,
        messages: [
          { role: 'system', content: prompt },
          ...messagesToSummarize.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '[Image/Attachment]'
          }))
        ],
      }, {
        headers: { 'Authorization': `Bearer ${config.apiKey}` },
        timeout: 15000
      });

      const summary = res.data.choices?.[0]?.message?.content;
      if (summary) {
        // Транзакционно удаляем старое и добавляем суммаризацию
        await dbRepo.deleteMessages(idsToDelete);
        await dbRepo.addMessage(characterId, userId, {
          role: 'system',
          content: `Historical Context Summary: ${summary.trim()}`
        });
        console.log(`[AI SERVICE] Automated summary generated for character ${characterId} for user ${userId}`);
      }
    } catch (e) {
      console.error('[AI SERVICE] Context summarization failed:', e instanceof Error ? e.message : e);
    }
  }

  /**
   * Безопасная обработка изображения с ресайзом
   */
  async processImage(base64: string): Promise<string> {
    try {
      // Чистим base64 от возможных префиксов
      const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      const data = matches ? matches[2] : base64;

      const imgBuffer = Buffer.from(data, 'base64');

      // Senior-level обработка: ресайз с сохранением пропорций
      const resizedBuffer = await sharp(imgBuffer)
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();

      return `data:image/jpeg;base64,${resizedBuffer.toString('base64')}`;
    } catch (err) {
      console.error('[AI SERVICE] Image processing error:', err);
      throw new Error('Failed to process image for AI input');
    }
  }

  /**
   * Получение стримингового ответа с гарантированным сохранением контекста
   */
  async getStreamingResponse(character: Character, history: ChatMessage[], newUserMessage?: string, imageBase64?: string) {
    // 1. Сначала подтягиваем системный промпт
    const aiMessages: AiMessage[] = [];

    let baseSystemPrompt = character.system_prompt || 'You are a helpful AI assistant.';
    if (character.scenario) baseSystemPrompt += `\nScenario/Setting: ${character.scenario}`;

    aiMessages.push({ role: 'system', content: baseSystemPrompt });

    // 2. Добавляем последние N сообщений истории (избегаем амнезии)
    const recentHistory = history.slice(-config.maxHistoryMessages);

    recentHistory.forEach((msg) => {
      aiMessages.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content as string | AiContentItem[]
      });
    });

    // 3. Обработка изображения "на лету", если оно передано отдельно
    if (imageBase64 && aiMessages.length > 0) {
      const lastMsg = aiMessages[aiMessages.length - 1];
      if (lastMsg.role === 'user' && typeof lastMsg.content === 'string') {
        const processedImage = await this.processImage(imageBase64);
        lastMsg.content = [
          { type: 'text', text: lastMsg.content },
          { type: 'image_url', image_url: { url: processedImage } }
        ];
      }
    }

    // 4. Делаем запрос к API
    return await axios.post(config.apiUrl, {
      model: config.aiDefaultModel,
      temperature: character.temperature ?? config.aiTemperature,
      max_tokens: character.max_tokens ?? config.aiMaxTokens,
      top_p: config.aiTopP,
      frequency_penalty: config.aiFrequencyPenalty,
      presence_penalty: config.aiPresencePenalty,
      safe_prompt: config.aiSafePrompt,
      provider: config.aiProvider,
      reasoning: config.aiReasoning,
      messages: aiMessages,
      stream: true,
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      timeout: 30000 // Ждем не больше 30 секунд
    });
  }
}

export const aiService = new AiService();
