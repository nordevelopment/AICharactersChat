import axios from 'axios';
import sharp from 'sharp';
import { createParser } from 'eventsource-parser';
import { config } from '../config/config';
import { ChatMessage, Character as CharacterType } from '../types';
import { Message } from '../models/Message';
import { ALL_TOOLS, executeTool } from '../tools/tools';

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
   * Compact conversation summary
   */
  async summarizeIfNeeded(characterId: number, userId: number, logger?: any): Promise<void> {
    const history = Message.getHistory(characterId, userId, true);
    if (history.length <= 30) return;

    const messagesToSummarize = history.slice(0, 15);
    const idsToDelete = messagesToSummarize.filter(m => m.id).map(m => m.id!);

    try {
      const prompt = 'Briefly summarize the dialogue';
      const res = await axios.post(config.apiUrl, {
        model: config.aiDefaultModel,
        temperature: 0.3,
        messages: [
          { role: 'system', content: prompt },
          ...messagesToSummarize.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '[Attachment]'
          }))
        ],
      }, {
        headers: { 'Authorization': `Bearer ${config.apiKey}` },
        timeout: 30000
      });

      const summary = res.data.choices?.[0]?.message?.content;
      if (summary) {
        Message.deleteBatch(idsToDelete);
        Message.add(characterId, userId, {
          role: 'system',
          content: `History Summary: ${summary.trim()}`
        });
      }
    } catch (e) {
      logger?.error('[AI SERVICE] Summarization failed');
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
  async getAiResponse(character: CharacterType, history: ChatMessage[], newUserMessage?: string, imageBase64?: string, logger?: any, userName?: string, extraMessages?: any[]) {
    let sys = character.system_prompt || 'Helpful assistant.';
    if (userName) sys = sys.replace(/{{user}}/g, userName);
    sys = sys.replace(/{{char}}/g, character.name);
    if (character.scenario) sys += `\nScenario: ${character.scenario}`;

    const aiMessages: AiMessage[] = [{ role: 'system', content: sys }];
    const recentHistory = history.slice(-config.maxHistoryMessages);

    for (const msg of recentHistory) {
      const role = msg.role as any;
      let content = msg.content;
      let tool_call_id = (msg as any).tool_call_id;
      let tool_calls = (msg as any).tool_calls;
      let name = (msg as any).name;

      if (typeof msg.content === 'object' && !Array.isArray(msg.content)) {
        const data = msg.content as any;
        content = data.content || null;
        if (data.tool_call_id) tool_call_id = data.tool_call_id;
        if (data.tool_calls) tool_calls = data.tool_calls;
        if (data.name) name = data.name;
      }

      const m: AiMessage = { role, content: content as any };
      if (tool_call_id) m.tool_call_id = tool_call_id;
      if (tool_calls) m.tool_calls = tool_calls;
      if (name) m.name = name;

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
      for (const em of extraMessages) {
        const cleanExtra: AiMessage = { role: em.role, content: em.content || null };
        if (em.tool_call_id) cleanExtra.tool_call_id = em.tool_call_id;
        if (em.tool_calls) cleanExtra.tool_calls = em.tool_calls;
        if (em.name) cleanExtra.name = em.name;
        aiMessages.push(cleanExtra);
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

    if (character.tools === 1) {
      payload.tools = ALL_TOOLS;
      payload.tool_choice = 'auto';
    }

    try {
      const res = await axios.post(config.apiUrl, payload, {
        headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        responseType: config.aiStreaming ? 'stream' : 'json',
        timeout: 60000
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
    history: ChatMessage[],
    message?: string,
    imageBase64?: string,
    logger?: any,
    userName?: string,
    userId?: number
  ): AsyncGenerator<{ reply?: string; done?: boolean; fullReply?: string }> {

    const response = await this.getAiResponse(character, history, message, imageBase64, logger, userName);
    let fullReply = '';
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
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!pendingToolCalls[idx]) pendingToolCalls[idx] = { id: '', name: '', args: '' };
                if (tc.id) pendingToolCalls[idx].id = tc.id;
                if (tc.function?.name) pendingToolCalls[idx].name += tc.function.name;
                if (tc.function?.arguments) pendingToolCalls[idx].args += tc.function.arguments;
              }
            }
          } catch { }
        }
      });

      let prevLen = 0;
      for await (const chunk of response.data) {
        parser.feed(chunk.toString());
        if (fullReply.length > prevLen) {
          yield { reply: fullReply.slice(prevLen) };
          prevLen = fullReply.length;
        }
      }
    } else {
      const resData = response.data.choices?.[0]?.message;
      usage = response.data.usage;
      if (resData) {
        fullReply = resData.content || '';
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
        result: await executeTool(tc.name, tc.args, logger)
      })));

      const toolResultsForAi: any[] = [];

      // Preservation of the text before image for triggerMsg
      const preImageText = fullReply;

      // Handle special injection and construct AI results
      for (const tr of toolResultsRaw) {
        if (tr.name === 'generate_image' && !tr.result.toLowerCase().startsWith('error')) {
          const url = tr.result;
          const markdown = `\n\n![Image](${url})\n\n[Full size](${url})\n\n`;
          yield { reply: markdown };
          fullReply += markdown;

          toolResultsForAi.push({
            role: 'tool',
            tool_call_id: tr.id,
            content: `Image: ${url} (Displayed to user)`
          });
        } else {
          toolResultsForAi.push({
            role: 'tool',
            tool_call_id: tr.id,
            content: tr.result
          });
        }
      }

      const assistantMsg: AiMessage = {
        role: 'assistant',
        content: preImageText || null, // Send back what was already written
        tool_calls: pendingToolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.args }
        }))
      };

      const secondRes = await this.getAiResponse(character, history, message, imageBase64, logger, userName, [assistantMsg, ...toolResultsForAi]);
      let prevLen = 0;
      const secondStartLen = fullReply.length;

      if (config.aiStreaming) {
        const pParser = createParser({
          onEvent: (event) => {
            if (event.data === '[DONE]') return;
            try {
              const data = JSON.parse(event.data);
              if (data.usage) usage = data.usage;
              const text = data.choices?.[0]?.delta?.content;
              if (text) fullReply += text;
            } catch { }
          }
        });
        for await (const chunk of secondRes.data) {
          pParser.feed(chunk.toString());
          if (fullReply.length > (secondStartLen + prevLen)) {
            yield { reply: fullReply.slice(secondStartLen + prevLen) };
            prevLen = fullReply.length - secondStartLen;
          }
        }
      } else {
        const more = secondRes.data.choices?.[0]?.message?.content || '';
        usage = secondRes.data.usage;
        fullReply += more;
        yield { reply: more };
      }
    } else if (!config.aiStreaming) {
      if (fullReply) yield { reply: fullReply };
    }

    if (usage && logger) {
      logger.info({
        usage,
        fullReplyLength: fullReply.length,
        model: config.aiDefaultModel
      }, '[AI SERVICE] Final Response Statistics');
    }

    yield { done: true, fullReply };
  }
}

export const aiService = new AiService();
