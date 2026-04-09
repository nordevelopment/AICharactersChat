import axios from 'axios';
import sharp from 'sharp';
import { createParser } from 'eventsource-parser';
import { config } from '../../config/config';
import { ChatMessage, Character as CharacterType } from '../../types';
import { Message } from '../../models/Message';
import { ALL_TOOLS, executeTool } from '../../tools/tools';
import { MemoryService } from '../memory.service';
import { ImageProcessor } from './image.processor';
import { ToolExecutor } from './tool.executor';

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

export class ChatService {
  private toolExecutor?: ToolExecutor;

  constructor(
    private memoryService: MemoryService,
    private imageProcessor: ImageProcessor,
    toolExecutor?: ToolExecutor
  ) {
    this.toolExecutor = toolExecutor;
  }

  /**
   * Compact conversation summary and memory extraction
   */
  async summarizeIfNeeded(characterId: number, userId: number, logger?: any): Promise<void> {
    const history = Message.getHistory(characterId, userId);
    if (history.length <= config.maxHistoryMessages) return;

    const countToSummarize = Math.floor(config.maxHistoryMessages / 2);
    const messagesToSummarize = history.slice(0, countToSummarize);
    const idsToDelete = messagesToSummarize.filter(m => m.id).map(m => m.id!);

    await this.extractFacts(messagesToSummarize, characterId, userId, logger);

    try {
      Message.deleteBatch(idsToDelete);
      logger?.info({ count: idsToDelete.length }, '[CHAT SERVICE] Old history cleaned up and moved to vector memory');
    } catch (e) {
      logger?.error({ error: e }, '[CHAT SERVICE] History cleanup failed');
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
          .filter((f: string) => f.length > 5);

        for (const fact of facts) {
          await this.memoryService.addMemory(userId, characterId, fact, logger);
        }
        logger?.info({ count: facts.length }, '[CHAT SERVICE] Facts extracted to memory');
      }
    } catch (e) {
      logger?.error({ error: e }, '[CHAT SERVICE] Fact extraction failed');
    }
  }

  /**
   * Check if current user message should be processed for memory immediately
   */
  async processImmediateMemory(message: string, characterId: number, userId: number, logger?: any): Promise<void> {
    const memoryRegex = /^(remember|save|store)\s*[:\-\s]\s*(.+)/i;
    const match = message.match(memoryRegex);
    
    if (match) {
      const fact = match[2].trim();
      if (fact.length > 2) {
        logger?.info({ fact }, '[CHAT SERVICE] Saving explicit fact directly');
        await this.memoryService.addMemory(userId, characterId, fact, logger);
      }
    }
  }

  /**
   * Inject relevant long-term memories into the system prompt (RAG)
   */
  async injectMemoryContext(sysPrompt: string, characterId: number, userId: number, query?: string, logger?: any): Promise<string> {
    if (!query) return sysPrompt;

    try {
      const memories = await this.memoryService.searchMemories(userId, characterId, query, 5, logger);
      if (memories.length > 0) {
        const contextMemory = memories.map(m => `- ${m.content}`).join('\n');
        const memoryBlock = `\n\n## YOUR LONG-TERM MEMORIES (USE WHEN NEEDED):\n${contextMemory}\n\nUse these memories if the user asks you about them or if you remember them.`;
        
        logger?.info({ 
          count: memories.length, 
          query,
          memories: memories.map(m => m.content)
        }, '[CHAT SERVICE] RAG Context injected into prompt');
        
        return sysPrompt + memoryBlock;
      } else {
        logger?.info({ query }, '[CHAT SERVICE] No relevant memories found');
      }
    } catch (err) {
      logger?.error({ error: err }, '[CHAT SERVICE] RAG Search failed');
    }

    return sysPrompt;
  }

  /**
   * Core request to AI API
   */
  async getAiResponse(character: CharacterType, history: ChatMessage[], newUserMessage?: string, imageBase64?: string, logger?: any, userName?: string, extraMessages?: any[], userId?: number) {
    let sys = character.system_prompt || 'Helpful assistant.';
    if (userName) sys = sys.replace(/{{user}}/g, userName);
    sys = sys.replace(/{{char}}/g, character.name);
    if (character.scenario) sys += `\nScenario: ${character.scenario}`;

    // RAG: Search for relevant memories
    if (userId) {
      const lastMessages = history.slice(-3);
      const contextQuery = lastMessages
        .filter(m => typeof m.content === 'string')
        .map(m => m.content)
        .join('\n');
      
      const query = newUserMessage || contextQuery;
      if (query) {
        sys = await this.injectMemoryContext(sys, character.id, userId, query, logger);
      }
    }

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

      aiMessages.push(m);
    }

    if (imageBase64 && aiMessages.length > 0) {
      const last = aiMessages[aiMessages.length - 1];
      if (last.role === 'user' && typeof last.content === 'string') {
        const img = await this.imageProcessor.processImage(imageBase64, logger);
        last.content = [{ type: 'text', text: last.content || '' }, { type: 'image_url', image_url: { url: img } }];
      }
    }

    if (extraMessages) {
      for (const em of extraMessages) {
        const cleanExtra: AiMessage = { role: em.role, content: em.content || null };
        if (em.tool_call_id) cleanExtra.tool_call_id = em.tool_call_id;
        if (em.tool_calls) cleanExtra.tool_calls = em.tool_calls;
        if (em.name) cleanExtra.name = em.name;

        logger?.info({ message: cleanExtra }, '[CHAT SERVICE] Extra Message');
        aiMessages.push(cleanExtra);
      }
    }

    logger?.info({ messages: aiMessages }, '[CHAT SERVICE] AI Request Messages');
    const payload: any = {
      model: config.aiDefaultModel,
      temperature: character.temperature ?? config.aiTemperature,
      max_tokens: character.max_tokens ?? config.aiMaxTokens,
      messages: aiMessages,
      stream: config.aiStreaming,
      stream_options: config.aiStreaming ? { include_usage: true } : undefined
    };

    if (character.tools === 1) {
      payload.tools = ALL_TOOLS;
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
      logger?.error({ status: err.response?.status, error: msg }, '[CHAT SERVICE] API Failure');
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
    userName?: string
  ): AsyncGenerator<{ reply?: string; reasoning?: string; done?: boolean; fullReply?: string }> {

    // 1. Check greeting message (if first message)
    const historyInDB = Message.getHistory(character.id, userId);
    if (historyInDB.length === 0 && character.first_message) {
      Message.add(character.id, userId, { role: 'assistant', content: character.first_message }, 1);
    }

    // 2. Save user message to database (if it exists)
    if (message) {
      Message.add(character.id, userId, { role: 'user', content: message });
      
      // Start background tasks for memory extraction and history cleanup
      this.processImmediateMemory(message, character.id, userId, logger).catch(err => {
        logger?.error(err, '[CHAT SERVICE] Immediate memory extraction failed');
      });

      this.summarizeIfNeeded(character.id, userId, logger).catch(err => {
        logger?.error(err, '[CHAT SERVICE] Background summarization failed');
      });
    }

    // 3. Get current history for AI
    const history = Message.getHistory(character.id, userId);

    const response = await this.getAiResponse(character, history, message, imageBase64, logger, userName, undefined, userId);
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
          } catch (e) {
            logger?.error('[CHAT SERVICE] Error parsing SSE event', event);
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
        logger.info({ text: reasoningText }, '[CHAT SERVICE] Reasoning Pass 1');
      }
    } else {
      const resData = response.data.choices?.[0]?.message;
      usage = response.data.usage;
      if (resData) {
        fullReply = resData.content || '';
        if (character.reasoning === 1) {
          const pass1Reason = resData.reasoning_content || resData.reasoning;
          if (pass1Reason) {
            if (logger) logger.info({ text: pass1Reason }, '[CHAT SERVICE] Reasoning Pass 1');
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

    if (pendingToolCalls.length > 0 && this.toolExecutor) {
      yield* this.toolExecutor.handleToolCalls(
        pendingToolCalls,
        fullReply,
        character,
        userId,
        history,
        message,
        imageBase64,
        logger,
        userName,
        usage
      );
    } else {
      if (!config.aiStreaming && fullReply) {
        yield { reply: fullReply };
      }
      
      // Save final response for non-tool case
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
      }, '[CHAT SERVICE] Final Response Statistics');
    }
  }
}
