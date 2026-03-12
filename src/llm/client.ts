import OpenAI from 'openai';
import { KeyRotationManager } from './key-rotation.js';
import type { LLMMessage, LLMResponse, ToolDefinition } from './types.js';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const MAX_RETRIES = 3;

export class LLMClient {
  private keyManager: KeyRotationManager;
  private model: string;

  constructor() {
    this.keyManager = new KeyRotationManager();
    this.model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  }

  async chat(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    retryCount = 0
  ): Promise<LLMResponse> {
    const apiKey = this.keyManager.next();
    const client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });

    try {
      const response = await client.chat.completions.create({
        model: this.model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        tools: tools as OpenAI.Chat.ChatCompletionTool[] | undefined,
        tool_choice: tools?.length ? 'auto' : undefined,
      });

      const choice = response.choices[0];
      return {
        content: choice.message.content ?? null,
        tool_calls: choice.message.tool_calls?.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
        finish_reason: choice.finish_reason,
      };
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      // Rotate key on rate limit and retry
      if (error.status === 429 && retryCount < MAX_RETRIES) {
        console.error(`[LLM] Rate limit on key ${retryCount + 1}, rotating... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        return this.chat(messages, tools, retryCount + 1);
      }
      throw new Error(`LLM request failed: ${error.message ?? String(err)}`);
    }
  }
}
