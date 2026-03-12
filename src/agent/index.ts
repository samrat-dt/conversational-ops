import { LLMClient } from '../llm/client.js';
import type { LLMMessage } from '../llm/types.js';
import type { PipelineConfig } from '../config/types.js';
import { buildSystemPrompt } from './prompt-builder.js';
import { buildToolRegistry } from './tool-registry.js';

const MAX_TOOL_ROUNDS = 10;

export class Agent {
  private llm: LLMClient;
  private config: PipelineConfig;
  private systemPrompt: string;
  private history: LLMMessage[] = [];

  constructor(config: PipelineConfig) {
    this.llm = new LLMClient();
    this.config = config;
    this.systemPrompt = buildSystemPrompt(config);
  }

  /** Process a single user message. Returns the assistant's final text response. */
  async run(userInput: string): Promise<string> {
    const registry = buildToolRegistry(this.config);
    const toolDefs = Array.from(registry.values()).map(t => t.definition);

    this.history.push({ role: 'user', content: userInput });

    const messages: LLMMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...this.history,
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.llm.chat(messages, toolDefs);

      if (response.finish_reason === 'tool_calls' && response.tool_calls?.length) {
        // Add assistant message with tool calls
        const assistantMsg: LLMMessage = {
          role: 'assistant',
          content: response.content,
          tool_calls: response.tool_calls,
        };
        messages.push(assistantMsg);
        this.history.push(assistantMsg);

        // Execute each tool call
        for (const toolCall of response.tool_calls) {
          const tool = registry.get(toolCall.function.name);
          let toolResult: string;

          if (!tool) {
            toolResult = `Error: Unknown tool "${toolCall.function.name}"`;
          } else {
            try {
              const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
              console.error(`[Tool] ${toolCall.function.name}(${JSON.stringify(args)})`);
              toolResult = await tool.handler(args);
            } catch (err: unknown) {
              toolResult = `Error executing ${toolCall.function.name}: ${(err as Error).message}`;
            }
          }

          const toolMsg: LLMMessage = {
            role: 'tool',
            content: toolResult,
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
          };
          messages.push(toolMsg);
          this.history.push(toolMsg);
        }

        continue; // next round
      }

      // Final response
      const finalContent = response.content ?? '(no response)';
      this.history.push({ role: 'assistant', content: finalContent });
      return finalContent;
    }

    return 'Error: Exceeded maximum tool call rounds. Please try again.';
  }

  /** Clear conversation history (but keep config/system prompt). */
  resetHistory(): void {
    this.history = [];
  }
}
