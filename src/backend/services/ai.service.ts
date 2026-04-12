import axios from 'axios';
import sharp from 'sharp';
import { createParser } from 'eventsource-parser';
import { config } from '../config/config';
import { ChatMessage, Character as CharacterType, User } from '../types';
import { Message } from '../models/Message';
import { User as UserModel } from '../models/User';
import { getAvailableTools, executeTool } from '../tools/tools';
import { memoryService } from './memory.service';

/**
 * OpenAI-compatible message types
 */
interface AiContentItem {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | AiContentItem[] | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export class AiService {
  /**
   * Compact conversation summary and memory extraction
   */
  async summarizeIfNeeded(characterId: number, userId: number, logger?: any): Promise<void> {
    const history = Message.getHistory(characterId, userId);
    // We use the limit from the config
    if (history.length <= config.maxHistoryMessages) return;

    // We take the first half of the messages for compression and memory extraction
    const countToSummarize = Math.floor(config.maxHistoryMessages / 2);
    const messagesToSummarize = history.slice(0, countToSummarize);
    const idsToDelete = messagesToSummarize.filter(m => m.id).map(m => m.id!);

    // We extract facts from the messages before deleting
    await this.extractFacts(messagesToSummarize, characterId, userId, logger);

    try {
      // We delete the old messages
      Message.deleteBatch(idsToDelete);
      logger?.info({ count: idsToDelete.length }, '[AI SERVICE] Old history cleaned up and moved to vector memory');
    } catch (e) {
      logger?.error({ error: e }, '[AI SERVICE] History cleanup failed');
    }
  }

  /**
   * Extract key facts from history to long-term memory
   */
  async extractFacts(messages: ChatMessage[], characterId: number, userId: number, logger?: any): Promise<void> {
    if (messages.length === 0) return;
    try {
      const historyText = messages.map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : '[Media]'}`).join('\n');
      const prompt = `Extract key short facts events from this dialogue. 
Return only a bulleted list of events, or "NONE" if no new events found. Use the same language as the dialogue.`;

      const res = await axios.post(config.apiUrl, {
        model: config.aiDefaultModel,
        temperature: 0.3,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: historyText }
        ],
      }, {
        headers: { 'Authorization': `Bearer ${config.apiKey}` },
        timeout: 60000
      });

      const content = res.data.choices?.[0]?.message?.content;
      if (content && content.toUpperCase().indexOf('NONE') === -1) {
        const facts = content.split('\n')
          .map((f: string) => f.replace(/^[-*]\s*/, '').trim())
          .filter((f: string) => f.length > 5); // Removed the colon requirement

        for (const fact of facts) {
          await memoryService.addMemory(userId, characterId, fact, logger);
        }
        logger?.info({ count: facts.length }, '[AI SERVICE] Facts extracted to memory');
      }
    } catch (e) {
      logger?.error({ error: e }, '[AI SERVICE] Fact extraction failed');
    }
  }

  /**
   * Process and resize incoming images
   */
  async processImage(base64: string, logger?: any): Promise<string> {
    try {
      const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      const data = matches ? matches[2] : base64;
      const imgBuffer = Buffer.from(data, 'base64');

      const resized = await sharp(imgBuffer)
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      return `data:image/jpeg;base64,${resized.toString('base64')}`;
    } catch (err: any) {
      logger?.error({ error: err.message }, '[AI SERVICE] Image processing error');
      throw new Error('Image processing failed');
    }
  }

  /**
   * Core request to AI API
   */
  async getAiResponse(character: CharacterType, history: ChatMessage[], newUserMessage?: string, imageBase64?: string, logger?: any, user?: User, extraMessages?: any[]) {
    let sys = character.system_prompt || 'Helpful assistant.';
    if (user) sys = sys.replace(/{{user}}/g, user.display_name);
    sys = sys.replace(/{{char}}/g, character.name);
    if (character.scenario) sys += `\nScenario: ${character.scenario}`;
    
    // Add user context if available
    if (user) {
      logger?.info({ userId: user.id, display_name: user.display_name, about: user.about }, '[AI SERVICE] Adding user context');
      sys += `\nName: ${user.display_name}`;
      if (user.about) {
        sys += `\nAbout: ${user.about}`;
        logger?.info({ userAbout: user.about }, '[AI SERVICE] User about field added to prompt');
      }
    }

    // AI uses save_memory and get_memory tools autonomously - no RAG injection needed

    const aiMessages: AiMessage[] = [{ role: 'system', content: sys }];
    const recentHistory = history.slice(-config.maxHistoryMessages);

    for (const msg of recentHistory) {
      const role = msg.role as any;
      const m: AiMessage = {
        role,
        content: msg.content as any
      };

      if (msg.tool_call_id) m.tool_call_id = msg.tool_call_id;
      if (msg.tool_calls) m.tool_calls = msg.tool_calls;
      if (msg.name) m.name = msg.name;

      // logger?.info({ message: m }, '[AI SERVICE] AI Message');
      aiMessages.push(m);
    }

    if (imageBase64 && aiMessages.length > 0) {
      const last = aiMessages[aiMessages.length - 1];
      if (last.role === 'user' && typeof last.content === 'string') {
        const img = await this.processImage(imageBase64, logger);
        last.content = [{ type: 'text', text: last.content || '' }, { type: 'image_url', image_url: { url: img } }];
      }
    }

    if (extraMessages) {
      logger?.info({ count: extraMessages.length }, '[AI SERVICE] Processing extra messages');
      const cleanExtraMessages: AiMessage[] = [];
      for (const em of extraMessages) {
        const cleanExtra: AiMessage = { role: em.role, content: em.content || null };
        if (em.tool_call_id) cleanExtra.tool_call_id = em.tool_call_id;
        if (em.tool_calls) cleanExtra.tool_calls = em.tool_calls;
        if (em.name) cleanExtra.name = em.name;

        cleanExtraMessages.push(cleanExtra);
      }
      aiMessages.push(...cleanExtraMessages);
      logger?.info({ messages: cleanExtraMessages }, '[AI SERVICE] Extra Messages added');
    }
    

    logger?.info({ messages: aiMessages }, '[AI SERVICE] AI Request Messages');
    logger?.info({ systemPrompt: sys }, '[AI SERVICE] System Prompt with User Context');
    const payload: any = {
      model: config.aiDefaultModel,
      temperature: character.temperature ?? config.aiTemperature,
      max_tokens: character.max_tokens ?? config.aiMaxTokens,
      messages: aiMessages,
      stream: config.aiStreaming,
      stream_options: config.aiStreaming ? { include_usage: true } : undefined
    };

    const availableTools = getAvailableTools(character.is_agent === 1);
    if (availableTools.length > 0) {
      payload.tools = availableTools;
      payload.tool_choice = 'auto';
    }

    if (character.reasoning === 1) {
      payload.include_reasoning = true;
    }

    try {
      const res = await axios.post(config.apiUrl, payload, {
        headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        responseType: config.aiStreaming ? 'stream' : 'json',
        timeout: 120000
      });
      return res;
    } catch (err: any) {
      let errorData = err.response?.data;
      if (errorData && typeof errorData.on === 'function') {
        try {
          const chunks = [];
          for await (const chunk of errorData) chunks.push(chunk);
          errorData = Buffer.concat(chunks).toString();
          try { errorData = JSON.parse(errorData); } catch { }
        } catch (r) { errorData = '[Stream error]'; }
      }
      const msg = errorData?.error?.message || errorData?.message || err.message;
      logger?.error({ status: err.response?.status, error: msg }, '[AI SERVICE] API Failure');
      throw new Error(`AI API Failure (${err.response?.status}): ${msg}`);
    }
  }

  /**
   * Generator for chat response
   */
  async *streamChatResponse(
    character: CharacterType,
    userId: number,
    message?: string,
    imageBase64?: string,
    logger?: any,
    user?: User
  ): AsyncGenerator<{ reply?: string; reasoning?: string; done?: boolean; fullReply?: string }> {

    // 1. Check greeting message (if first message)
    const historyInDB = Message.getHistory(character.id, userId);
    if (historyInDB.length === 0 && character.first_message) {
      Message.add(character.id, userId, { role: 'assistant', content: character.first_message }, 1);
    }

    // 2. Save user message to database (if it exists)
    if (message) {
      Message.add(character.id, userId, { role: 'user', content: message });
      
      // Start background tasks for history cleanup and memory extraction
      this.summarizeIfNeeded(character.id, userId, logger).catch((err: any) => {
        logger?.error(err, '[AI SERVICE] Background summarization failed');
      });
    }

    // 3. Получаем актуальную историю для нейросети
    const history = Message.getHistory(character.id, userId);

    const response = await this.getAiResponse(character, history, message, imageBase64, logger, user, undefined);
    let fullReply = '';
    let reasoningText = '';
    const pendingToolCalls: any[] = [];
    let usage: any = null;

    if (config.aiStreaming) {
      const parser = createParser({
        onEvent: (event) => {
          if (event.data === '[DONE]') return;
          try {
            const data = JSON.parse(event.data);
            if (data.usage) usage = data.usage;

            const delta = data.choices?.[0]?.delta;
            if (!delta) return;

            if (delta.content) fullReply += delta.content;
            if (character.reasoning === 1 && delta.reasoning_content) reasoningText += delta.reasoning_content;
            if (character.reasoning === 1 && delta.reasoning) reasoningText += delta.reasoning;
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!pendingToolCalls[idx]) pendingToolCalls[idx] = { id: '', name: '', args: '' };
                if (tc.id) pendingToolCalls[idx].id = tc.id;
                if (tc.function?.name) pendingToolCalls[idx].name += tc.function.name;
                if (tc.function?.arguments) pendingToolCalls[idx].args += tc.function.arguments;
              }
            }
          } catch {
            logger?.error('[AI SERVICE] Error parsing SSE event', event);
          }
        }
      });

      let prevLen = 0;
      let prevReasoningLen = 0;
      for await (const chunk of response.data) {
        parser.feed(chunk.toString());
        if (fullReply.length > prevLen) {
          yield { reply: fullReply.slice(prevLen) };
          prevLen = fullReply.length;
        }
        if (reasoningText.length > prevReasoningLen) {
          yield { reasoning: reasoningText.slice(prevReasoningLen) };
          prevReasoningLen = reasoningText.length;
        }
      }

      if (character.reasoning === 1 && reasoningText && logger) {
        logger.info({ text: reasoningText }, '[AI SERVICE] Reasoning Pass 1');
      }
    } else {
      const resData = response.data.choices?.[0]?.message;
      usage = response.data.usage;
      if (resData) {
        fullReply = resData.content || '';
        if (character.reasoning === 1) {
          const pass1Reason = resData.reasoning_content || resData.reasoning;
          if (pass1Reason) {
            if (logger) logger.info({ text: pass1Reason }, '[AI SERVICE] Reasoning Pass 1');
            yield { reasoning: pass1Reason };
          }
        }
        if (resData.tool_calls) {
          resData.tool_calls.forEach((tc: any) => {
            pendingToolCalls.push({ id: tc.id, name: tc.function.name, args: tc.function.arguments });
          });
        }
      }
    }

    if (pendingToolCalls.length > 0) {
      const toolResultsRaw = await Promise.all(pendingToolCalls.map(async tc => ({
        id: tc.id,
        name: tc.name,
        result: await executeTool(tc.name, tc.args, logger, { userId, characterId: character.id })
      })));

      const toolResultsForAi: any[] = [];

      // Preservation of the text before image for triggerMsg
      const preImageText = fullReply;

      const assistantMsg: AiMessage = {
        role: 'assistant',
        content: preImageText || null, // Send back what was already written
        tool_calls: pendingToolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.args }
        }))
      };

      // Handle special injection and construct AI results
      for (const tr of toolResultsRaw) {
        let toolContent = tr.result;
        if (tr.name === 'generate_image' && !tr.result.toLowerCase().startsWith('error')) {
          const url = tr.result;
          // Check if AI already included this image in the response
          if (!fullReply.includes(url)) {
            const markdown = `\n\n![Image](${url})\n\n[Full size](${url})\n\n`;
            yield { reply: markdown };
            fullReply += markdown;
          }
          toolContent = `Image: ${url} (Displayed to user)`;
        }

        const toolMsg = {
          role: 'tool' as const,
          tool_call_id: tr.id,
          content: toolContent,
          name: tr.name
        };

        toolResultsForAi.push(toolMsg);
      }

      const secondRes = await this.getAiResponse(character, history, message, imageBase64, logger, user, [assistantMsg, ...toolResultsForAi]);
      let prevLen = 0;
      let prevReasoningLen = 0;
      const secondStartLen = fullReply.length;
      let secondPartReply = '';
      let secondReasoningText = '';

      if (config.aiStreaming) {
        const pParser = createParser({
          onEvent: (event) => {
            if (event.data === '[DONE]') return;
            try {
              const data = JSON.parse(event.data);
              if (data.usage) usage = data.usage;
              const text = data.choices?.[0]?.delta?.content;
              const reason = data.choices?.[0]?.delta?.reasoning_content || data.choices?.[0]?.delta?.reasoning;
              if (text) {
                fullReply += text;
                secondPartReply += text;
              }
              if (character.reasoning === 1 && reason) secondReasoningText += reason;
            } catch (e) {
              logger?.error({ error: e, event }, '[AI SERVICE] Error parsing second SSE event');
            }
          }
        });
        for await (const chunk of secondRes.data) {
          pParser.feed(chunk.toString());
          if (fullReply.length > (secondStartLen + prevLen)) {
            yield { reply: fullReply.slice(secondStartLen + prevLen) };
            prevLen = fullReply.length - secondStartLen;
          }
          if (secondReasoningText.length > prevReasoningLen) {
            yield { reasoning: secondReasoningText.slice(prevReasoningLen) };
            prevReasoningLen = secondReasoningText.length;
          }
        }
        if (character.reasoning === 1 && secondReasoningText && logger) {
          logger.info({ text: secondReasoningText }, '[AI SERVICE] Reasoning Pass 2');
        }
      } else {
        const more = secondRes.data.choices?.[0]?.message?.content || '';
        if (character.reasoning === 1) {
          const moreReason = secondRes.data.choices?.[0]?.message?.reasoning_content || secondRes.data.choices?.[0]?.message?.reasoning || '';
          if (moreReason) yield { reasoning: moreReason };
        }
        usage = secondRes.data.usage;
        fullReply += more;
        secondPartReply = more;
        yield { reply: more };
      }

      // Сохраняем финальный ответ с изображениями в markdown
      if (userId && fullReply) {
        // fullReply содержит текст + markdown для изображений
        Message.add(character.id, userId, { role: 'assistant', content: fullReply });
      }

      // Больше не возвращаем fullReply, так как он сохранен здесь
      yield { done: true };
    } else {
      if (!config.aiStreaming && fullReply) {
        yield { reply: fullReply };
      }
      
      // Сохраняем финальный ответ для не-тулл случая
      if (userId && fullReply) {
        Message.add(character.id, userId, { role: 'assistant', content: fullReply });
      }

      yield { done: true };
    }

    if (usage && logger) {
      logger.info({
        usage,
        fullReplyLength: fullReply.length,
        model: config.aiDefaultModel
      }, '[AI SERVICE] Final Response Statistics');
    }
  }
}

export const aiService = new AiService();
