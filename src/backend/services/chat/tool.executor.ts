import { createParser } from 'eventsource-parser';
import { config } from '../../config/config';
import { ChatMessage, Character as CharacterType } from '../../types';
import { Message } from '../../models/Message';
import { executeTool } from '../../tools/tools';
import { aiService } from '../ai.service';

interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | any[] | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export class ToolExecutor {
  /**
   * Handle tool calls and continue conversation
   */
  async *handleToolCalls(
    pendingToolCalls: any[],
    fullReply: string,
    character: CharacterType,
    userId: number,
    history: ChatMessage[],
    message?: string,
    imageBase64?: string,
    logger?: any,
    userName?: string,
    usage?: any
  ): AsyncGenerator<{ reply?: string; reasoning?: string; done?: boolean }> {
    
    const toolResultsRaw = await Promise.all(pendingToolCalls.map(async tc => ({
      id: tc.id,
      name: tc.name,
      result: await executeTool(tc.name, tc.args, logger, { userId, characterId: character.id })
    })));

    const toolResultsForAi: any[] = [];
    const preImageText = fullReply;

    const assistantMsg: AiMessage = {
      role: 'assistant',
      content: preImageText || null,
      tool_calls: pendingToolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.args }
      }))
    };

    // Save intermediate assistant response with tool calls
    if (userId) {
      Message.add(character.id, userId, {
        role: 'assistant',
        content: assistantMsg.content as any,
        tool_calls: assistantMsg.tool_calls
      } as any);
    }

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

      // Save tool result
      if (userId) {
        Message.add(character.id, userId, toolMsg as any);
      }
    }

    const secondRes = await aiService.getAiResponse(character, history, message, imageBase64, logger, userName, [assistantMsg, ...toolResultsForAi], userId);
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
            logger?.error({ error: e, event }, '[TOOL EXECUTOR] Error parsing second SSE event');
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
        logger.info({ text: secondReasoningText }, '[TOOL EXECUTOR] Reasoning Pass 2');
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

    // Save final response with images in markdown
    if (userId && fullReply) {
      Message.add(character.id, userId, { role: 'assistant', content: fullReply });
    }

    yield { done: true };
  }
}
