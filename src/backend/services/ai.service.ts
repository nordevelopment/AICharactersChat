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
  async getAiResponse(character: CharacterType, history: ChatMessage[], logger?: any, user?: User, extraMessages?: AiMessage[], imageBase64?: string) {
    let sys = character.system_prompt || 'Helpful assistant.';
    if (user) {
      sys = sys.replace(/{{user}}/g, user.display_name);
    }
    sys = sys.replace(/{{char}}/g, character.name);
    if (character.scenario) sys += `\nScenario: ${character.scenario}`;
    
    // Add user identity context
    if (user) {
      sys += `\n\nUser Identity:\n- Name: ${user.display_name}`;
      if (user.about) sys += `\n- About User: ${user.about}`;
    }

    const aiMessages: AiMessage[] = [{ role: 'system', content: sys }];
    const recentHistory = history.slice(-config.maxHistoryMessages);

    for (const msg of recentHistory) {
      const m: AiMessage = {
        role: msg.role as any,
        content: msg.content as any
      };
      if (msg.tool_call_id) m.tool_call_id = msg.tool_call_id;
      if (msg.tool_calls) m.tool_calls = msg.tool_calls;
      if (msg.name) m.name = msg.name;
      aiMessages.push(m);
    }

    // Attach image to the last user message if provided
    if (imageBase64 && aiMessages.length > 0) {
      const last = aiMessages[aiMessages.length - 1];
      if (last.role === 'user' && typeof last.content === 'string') {
        const img = await this.processImage(imageBase64, logger);
        last.content = [{ type: 'text', text: last.content || '' }, { type: 'image_url', image_url: { url: img } }];
      }
    }

    if (extraMessages && extraMessages.length > 0) {
      for (const em of extraMessages) {
        aiMessages.push({
          role: em.role,
          content: em.content,
          tool_calls: em.tool_calls,
          tool_call_id: em.tool_call_id,
          name: em.name
        });
      }
    }

    const payload: any = {
      model: config.aiDefaultModel,
      temperature: character.temperature ?? config.aiTemperature,
      max_tokens: character.max_tokens ?? config.aiMaxTokens,
      messages: aiMessages,
      stream: config.aiStreaming,
      stream_options: config.aiStreaming ? { include_usage: true } : undefined
    };

    if (character.is_agent === 1) {
      payload.tools = getAvailableTools(true);
      payload.tool_choice = 'auto';
    }

    if (character.reasoning === 1) {
      payload.include_reasoning = true;
    }

    try {
      return await axios.post(config.apiUrl, payload, {
        headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        responseType: config.aiStreaming ? 'stream' : 'json',
        timeout: 120000
      });
    } catch (err: any) {
      let errorData = err.response?.data;
      if (errorData && typeof errorData.on === 'function') {
        try {
          const chunks = [];
          for await (const chunk of errorData) chunks.push(chunk);
          errorData = JSON.parse(Buffer.concat(chunks).toString());
        } catch { errorData = { message: 'Stream error' }; }
      }
      const msg = errorData?.error?.message || errorData?.message || err.message;
      logger?.error({ status: err.response?.status, error: msg }, '[AI SERVICE] API Failure');
      throw new Error(`AI API Failure (${err.response?.status}): ${msg}`);
    }
  }

  /**
   * Internal helper to parse AI response stream or JSON
   */
  private async *parseAiStream(response: any, character: CharacterType, logger: any, cumulativeUsage: any): AsyncGenerator<{ reply?: string; reasoning?: string }, { reply: string; reasoning: string; toolCalls: any[] }> {
    let reply = '';
    let reasoning = '';
    const toolCalls: any[] = [];

    if (config.aiStreaming) {
      const parser = createParser({
        onEvent: (event) => {
          if (event.data === '[DONE]') return;
          try {
            const data = JSON.parse(event.data);
            if (data.usage) {
              cumulativeUsage.prompt_tokens += (data.usage.prompt_tokens || 0);
              cumulativeUsage.completion_tokens += (data.usage.completion_tokens || 0);
              cumulativeUsage.total_tokens += (data.usage.total_tokens || 0);
            }
            const delta = data.choices?.[0]?.delta;
            if (!delta) return;

            if (delta.content) reply += delta.content;
            if (character.reasoning === 1 && (delta.reasoning_content || delta.reasoning)) {
              reasoning += (delta.reasoning_content || delta.reasoning);
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCalls[idx]) toolCalls[idx] = { id: '', name: '', args: '' };
                if (tc.id) toolCalls[idx].id = tc.id;
                if (tc.function?.name) toolCalls[idx].name += tc.function.name;
                if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments;
              }
            }
          } catch (e) {
            logger?.error({ error: e }, '[AI SERVICE] SSE parsing error');
          }
        }
      });

      let prevLen = 0;
      let prevReasoningLen = 0;
      for await (const chunk of response.data) {
        parser.feed(chunk.toString());
        if (reply.length > prevLen) {
          yield { reply: reply.slice(prevLen) };
          prevLen = reply.length;
        }
        if (reasoning.length > prevReasoningLen) {
          yield { reasoning: reasoning.slice(prevReasoningLen) };
          prevReasoningLen = reasoning.length;
        }
      }
    } else {
      const resData = response.data.choices?.[0]?.message;
      const u = response.data.usage;
      if (u) {
        cumulativeUsage.prompt_tokens += (u.prompt_tokens || 0);
        cumulativeUsage.completion_tokens += (u.completion_tokens || 0);
        cumulativeUsage.total_tokens += (u.total_tokens || 0);
      }
      if (resData) {
        reply = resData.content || '';
        reasoning = resData.reasoning_content || resData.reasoning || '';
        if (reasoning) yield { reasoning };
        if (reply) yield { reply };
        if (resData.tool_calls) {
          resData.tool_calls.forEach((tc: any) => {
            toolCalls.push({ id: tc.id, name: tc.function.name, args: tc.function.arguments });
          });
        }
      }
    }

    return { reply, reasoning, toolCalls: toolCalls.filter(Boolean) };
  }

  /**
   * Internal helper to execute tool calls and save sequences to DB
   */
  private async *executeToolChain(toolCalls: any[], currentReply: string, characterId: number, userId: number, logger: any): AsyncGenerator<{ reply?: string }, AiMessage[]> {
    const turnMessages: AiMessage[] = [];
    
    // 1. Assistant message that initiated tools
    const assistantMsg: AiMessage = {
      role: 'assistant',
      content: currentReply || null,
      tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.args }
      }))
    };
    
    if (userId) Message.add(characterId, userId, assistantMsg as any);
    turnMessages.push(assistantMsg);

    // 2. Execute each tool and record results
    for (const tc of toolCalls) {
      const result = await executeTool(tc.name, tc.args, logger, { userId, characterId });
      
      let toolContentForAi = result;
      if (tc.name === 'generate_image' && !result.toLowerCase().startsWith('error')) {
        const markdown = `\n\n![Image](${result})\n\n[Full size](${result})\n\n`;
        yield { reply: markdown };
        toolContentForAi = `Image generated: ${result} (Displayed to user)`;
      }

      const toolMsg: AiMessage = {
        role: 'tool',
        tool_call_id: tc.id,
        content: toolContentForAi,
        name: tc.name
      };

      if (userId) Message.add(characterId, userId, toolMsg as any);
      turnMessages.push(toolMsg);
    }

    return turnMessages;
  }

  /**
   * Generator for chat response (supports tool chains)
   */
  async *streamChatResponse(
    character: CharacterType,
    userId: number,
    message?: string,
    imageBase64?: string,
    logger?: any,
    user?: User
  ): AsyncGenerator<{ reply?: string; reasoning?: string; done?: boolean }> {

    // Initialize history
    const historyInDB = Message.getHistory(character.id, userId);
    if (historyInDB.length === 0 && character.first_message) {
      Message.add(character.id, userId, { role: 'assistant', content: character.first_message }, 1);
    }

    if (message) {
      const userMsg: AiMessage = { role: 'user', content: message };
      Message.add(character.id, userId, userMsg as any);
      this.summarizeIfNeeded(character.id, userId, logger).catch(err => 
        logger?.error(err, '[AI SERVICE] Background summarization failed')
      );
    }

    const history = Message.getHistory(character.id, userId);
    let extraMessages: AiMessage[] = [];
    let iteration = 0;
    const MAX_ITERATIONS = 5;
    let cumulativeUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      const response = await this.getAiResponse(character, history, logger, user, extraMessages, imageBase64);
      
      const { reply, reasoning, toolCalls } = yield* this.parseAiStream(response, character, logger, cumulativeUsage);
      
      if (reasoning && logger) {
        logger.info({ text: reasoning, iteration }, '[AI SERVICE] Reasoning Pass');
      }

      if (toolCalls.length === 0) {
        if (reply && userId) {
          Message.add(character.id, userId, { role: 'assistant', content: reply });
        }
        break;
      }

      // Execute tools and accumulate context for next turn
      const turnMessages = yield* this.executeToolChain(toolCalls, reply, character.id, userId, logger);
      extraMessages.push(...turnMessages);
      
      // Clear initial inputs for subsequent chain steps
      message = undefined;
      imageBase64 = undefined;
    }

    yield { done: true };
    if (logger && cumulativeUsage.total_tokens > 0) {
      logger.info({ usage: cumulativeUsage, model: config.aiDefaultModel }, '[AI SERVICE] All turns completed');
    }
  }
}

export const aiService = new AiService();
