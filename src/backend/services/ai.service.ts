import axios from 'axios';
import sharp from 'sharp';
import { createParser } from 'eventsource-parser';
import { config } from '../config/config';
import { ChatMessage, Character as CharacterType } from '../types';
import { Message } from '../models/Message';
// import { Character } from '../models/Character';
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
  role: 'system' | 'user' | 'assistant';
  content: string | AiContentItem[];
}

export class AiService {
  /**
   * Summarization of old messages to avoid bloating the context.
   * Called when the limit is reached.
   */
  async summarizeIfNeeded(characterId: number, userId: number, logger?: any): Promise<void> {
    const history = Message.getHistory(characterId, userId);

    // If there are less than 30 messages, don't bother the API
    if (history.length <= 30) return;

    // Take the first 15 messages for summarization
    // (leave a reserve of fresh messages in the history)
    const messagesToSummarize = history.slice(0, 15);
    const idsToDelete = messagesToSummarize.filter(m => m.id).map(m => m.id!);

    try {
      const prompt = 'You are a history chronologist. Briefly summarize the previous interaction context of the following dialogue in one concise paragraph:';

      if (config.debugAi && logger) {
        logger.info({ body: { model: config.aiDefaultModel, messages: messagesToSummarize.length } }, '[AI SERVICE] Context summarization request');
      }

      const res = await axios.post(config.apiUrl, {
        model: config.aiDefaultModel,
        temperature: 0.3, // Less creativity for summarization
        max_tokens: 350,
        messages: [
          { role: 'system', content: prompt },
          ...messagesToSummarize.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '[Image/Attachment]'
          }))
        ],
      }, {
        headers: { 'Authorization': `Bearer ${config.apiKey}` },
        timeout: 30000
      });

      if (config.debugAi && logger) {
        logger.info({ status: res.status }, '[AI SERVICE] Context summarization response');
      }

      const summary = res.data.choices?.[0]?.message?.content;
      if (summary) {
        // Transactionally delete old and add summarization
        Message.deleteBatch(idsToDelete);
        Message.add(characterId, userId, {
          role: 'system',
          content: `Historical Context Summary: ${summary.trim()}`
        });
        if (logger) {
          logger.info(`[AI SERVICE] Automated summary generated for character ${characterId} for user ${userId}`);
        }
      }
    } catch (e) {
      if (logger) {
        logger.error(e, '[AI SERVICE] Context summarization failed');
      }
    }
  }

  /**
   * Safe image processing with resizing
   */
  async processImage(base64: string): Promise<string> {
    try {
      // Clean base64 from possible prefixes
      const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      const data = matches ? matches[2] : base64;

      const imgBuffer = Buffer.from(data, 'base64');

      // Senior-level processing: resize with aspect ratio preservation
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
   * Get AI response with guaranteed context preservation
   */
  async getAiResponse(character: CharacterType, history: ChatMessage[], newUserMessage?: string, imageBase64?: string, logger?: any, userName?: string, extraMessages?: any[]) {
    // 1. Formulate system prompt
    let baseSystemPrompt = character.system_prompt || 'You are a helpful AI assistant.';

    // Add scenario if available
    if (character.scenario) {
      baseSystemPrompt += `\nScenario:\n${character.scenario}`;
    }

    // Substitute variables {{user}} and {{char}}
    if (userName) {
      baseSystemPrompt = baseSystemPrompt.replace(/{{user}}/g, userName);
    }
    baseSystemPrompt = baseSystemPrompt.replace(/{{char}}/g, character.name);

    const aiMessages: AiMessage[] = [];
    aiMessages.push({ role: 'system', content: baseSystemPrompt });

    // 2. Add last N messages from history (avoid amnesia)
    const recentHistory = history.slice(-config.maxHistoryMessages);

    recentHistory.forEach((msg) => {
      aiMessages.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content as string | AiContentItem[]
      });
    });

    // 3. Image processing on the fly if it is passed separately
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

    // Add messages from tools (for the second request in the tool loop)
    if (extraMessages && extraMessages.length > 0) {
      for (const em of extraMessages) {
        aiMessages.push(em);
      }
    }

    // Add tools only if the character has them enabled
    const requestBody: Record<string, any> = {
      model: config.aiDefaultModel,
      temperature: character.temperature ?? config.aiTemperature,
      max_tokens: character.max_tokens ?? config.aiMaxTokens,
      top_p: config.aiTopP,
      frequency_penalty: config.aiFrequencyPenalty,
      presence_penalty: config.aiPresencePenalty,
      safe_prompt: config.aiSafePrompt,
      provider: config.aiProvider,
      reasoning: character.reasoning ? { effort: 'low', exclude: true } : config.aiReasoning,
      messages: aiMessages,
      stream: config.aiStreaming,
    };

    if (config.aiStreaming) {
      requestBody.stream_options = { include_usage: true };
    }

    logger.info('character', character);

    // Add tools only if the character has them enabled
    if (character.tools === 1) {
      requestBody.tools = ALL_TOOLS;
      requestBody.tool_choice = 'auto';
    }

    if (config.debugAi && logger) {
      logger.info({ tools: requestBody.tools, stream: config.aiStreaming }, '[AI SERVICE] Outgoing AI Request');
    }

    try {
      const res = await axios.post(config.apiUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: config.aiStreaming ? 'stream' : 'json',
        timeout: 60000 // Increased timeout for non-streaming
      });

      if (config.debugAi && logger) {
        logger.info({
          status: res.status,
          headers: res.headers
        }, '[AI SERVICE] AI Response Started');
      }
      return res;
    } catch (err: any) {
      if (config.debugAi && logger) {
        let errorData = err.response?.data;
        
        // If data is a stream, we need to read it to see the actual error message
        if (errorData && typeof errorData.on === 'function') {
          try {
            // Buffer the error stream
            const chunks: Buffer[] = [];
            for await (const chunk of errorData) {
                chunks.push(chunk);
            }
            errorData = Buffer.concat(chunks).toString();
            try {
              errorData = JSON.parse(errorData);
            } catch (e) {
              // Not a JSON error, keep as string
            }
          } catch (e) {
            errorData = '[Could not read error stream]';
          }
        }

        logger.error({
          status: err.response?.status,
          error: errorData || err.message,
          headers: err.response?.headers
        }, '[AI SERVICE] AI API Request Failed');
      }
      throw err;
    }
  }

  /**
   * High-level method — async generator for the route.
   * Transparently handles the tool_calls loop:
   *   1. Collects the stream
   *   2. If the model calls tools — executes them, adds the results, and requests a final answer
   *   3. Streams the final text in { reply: string } chunks
   *   4. Upon completion, yields { done: true, fullReply: string }
   */
  async *streamChatResponse(
    character: CharacterType,
    history: ChatMessage[],
    message?: string,
    imageBase64?: string,
    logger?: any,
    userName?: string
  ): AsyncGenerator<{ reply?: string; done?: boolean; fullReply?: string }> {
    // ── First request to AI ─────────────────────────────────────────────
    const response = await this.getAiResponse(character, history, message, imageBase64, logger, userName);

    let fullReply = '';
    const pendingToolCalls: Array<{
      index: number;
      id: string;
      name: string;
      argumentsRaw: string;
    }> = [];

    if (config.aiStreaming) {
      // ── Read the first stream ───────────────────────────────────────────
      let firstChunkLogged = false;
      await new Promise<void>((resolve, reject) => {
        const parser = createParser({
          onEvent: (event) => {
            if (event.data === '[DONE]') { resolve(); return; }
            try {
              const data = JSON.parse(event.data);

              if (!firstChunkLogged && data.model && config.debugAi) {
                logger?.info({ model: data.model, id: data.id }, '[AI SERVICE] Session Started');
                firstChunkLogged = true;
              }

              const delta = data.choices?.[0]?.delta;
              if (!delta) return;

              if (delta.content) {
                fullReply += delta.content;
              }

              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!pendingToolCalls[idx]) {
                    pendingToolCalls[idx] = { index: idx, id: tc.id || '', name: '', argumentsRaw: '' };
                  }
                  if (tc.function?.name) pendingToolCalls[idx].name += tc.function.name;
                  if (tc.function?.arguments) pendingToolCalls[idx].argumentsRaw += tc.function.arguments;
                }
              }

              const finishReason = data.choices?.[0]?.finish_reason;
              if (finishReason === 'stop' || finishReason === 'tool_calls') {
                resolve();
              }
            } catch { }
          }
        });

        (async () => {
          try {
            for await (const chunk of response.data) {
              parser.feed(chunk.toString());
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        })();
      });
    } else {
      // ── Handle non-streaming response ──────────────────────────────────
      const data = response.data;
      const message = data.choices?.[0]?.message;
      if (message) {
        fullReply = message.content || '';
        if (message.tool_calls) {
          message.tool_calls.forEach((tc: any, idx: number) => {
            pendingToolCalls.push({
              index: idx,
              id: tc.id,
              name: tc.function.name,
              argumentsRaw: tc.function.arguments
            });
          });
        }
      }
    }

    // ── If tool_calls were detected — execute them and make a second request ───
    if (pendingToolCalls.length > 0) {
      logger?.info({ count: pendingToolCalls.length }, '[AI SERVICE] Tool calls detected, executing');

      const toolResults = await Promise.all(
        pendingToolCalls.map(async (tc) => ({
          tool_call_id: tc.id,
          name: tc.name,
          result: await executeTool(tc.name, tc.argumentsRaw, logger),
        }))
      );

      const assistantMsgWithToolCalls: AiMessage & { tool_calls?: any[] } = {
        role: 'assistant',
        content: fullReply || '',
        tool_calls: pendingToolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.argumentsRaw },
        })),
      };

      const toolResultMessages = toolResults.map((tr) => ({
        role: 'tool' as const,
        tool_call_id: tr.tool_call_id,
        name: tr.name,
        content: tr.result,
      }));

      const secondResponse = await this.getAiResponse(
        character, history, message, imageBase64, logger, userName,
        [assistantMsgWithToolCalls, ...toolResultMessages]
      );

      fullReply = ''; // Reset for the final answer

      if (config.aiStreaming) {
        const parser2 = createParser({
          onEvent: (event) => {
            if (event.data === '[DONE]') return;
            try {
              const data = JSON.parse(event.data);
              const content = data.choices?.[0]?.delta?.content;
              if (content) fullReply += content;
            } catch { }
          }
        });

        let prevLen = 0;
        for await (const chunk of secondResponse.data) {
          parser2.feed(chunk.toString());
          if (fullReply.length > prevLen) {
            yield { reply: fullReply.slice(prevLen) };
            prevLen = fullReply.length;
          }
        }
      } else {
        const data = secondResponse.data;
        fullReply = data.choices?.[0]?.message?.content || '';
        yield { reply: fullReply };
      }
    } else {
      // No tool_calls — return what we have
      if (fullReply) yield { reply: fullReply };
    }

    yield { done: true, fullReply };
  }
}

export const aiService = new AiService();
