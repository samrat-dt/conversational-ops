import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PipelineConfig } from '../src/config/types.js';

// Mock LLM client
vi.mock('../src/llm/client.js', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn(),
  })),
}));

// Mock GitHub
vi.mock('../src/github/issues.js', () => ({
  createIssue: vi.fn(),
  listIssues: vi.fn(),
  getIssue: vi.fn(),
  updateIssue: vi.fn(),
}));

vi.mock('../src/github/labels.js', () => ({
  ensureLabel: vi.fn(),
  applyLabel: vi.fn(),
  removeLabel: vi.fn(),
  ensureAllStageLabels: vi.fn(),
}));

vi.mock('../src/github/comments.js', () => ({
  addComment: vi.fn(),
  listComments: vi.fn(),
}));

import { Agent } from '../src/agent/index.js';
import { LLMClient } from '../src/llm/client.js';
import { createIssue } from '../src/github/issues.js';

const testConfig: PipelineConfig = {
  name: 'Test Pipeline',
  github: { owner: 'test-owner', repo: 'test-repo' },
  fields: [{ name: 'value', type: 'number', required: true }],
  stages: [
    { name: 'Lead', label: 'stage:lead' },
    { name: 'Qualified', label: 'stage:qualified' },
  ],
  calculations: [],
  reports: [],
};

describe('Agent', () => {
  let agent: Agent;
  let mockChat: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new Agent(testConfig);
    mockChat = vi.mocked(LLMClient).mock.results[0].value.chat as ReturnType<typeof vi.fn>;
  });

  it('returns LLM text response when no tool calls', async () => {
    mockChat.mockResolvedValue({
      content: 'Here are your pipeline items.',
      finish_reason: 'stop',
    });

    const result = await agent.run('Show me all items');
    expect(result).toBe('Here are your pipeline items.');
  });

  it('executes a tool call and returns final response', async () => {
    vi.mocked(createIssue).mockResolvedValue({
      number: 42,
      title: 'Acme Corp',
      body: '## Test Pipeline Item',
      state: 'open',
      labels: ['stage:lead'],
      assignees: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      html_url: 'https://github.com/test-owner/test-repo/issues/42',
    });

    // First call: LLM decides to call create_item
    mockChat
      .mockResolvedValueOnce({
        content: null,
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'create_item',
              arguments: JSON.stringify({ title: 'Acme Corp', stage: 'Lead', fields: { value: 50000 } }),
            },
          },
        ],
      })
      // Second call: LLM provides final response after tool result
      .mockResolvedValueOnce({
        content: 'Created item #42: "Acme Corp" in Lead stage.',
        finish_reason: 'stop',
      });

    const result = await agent.run('Add Acme Corp deal worth 50000 at Lead stage');
    expect(result).toContain('Created item #42');
    expect(createIssue).toHaveBeenCalledOnce();
  });

  it('handles unknown tool gracefully', async () => {
    mockChat
      .mockResolvedValueOnce({
        content: null,
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: 'call_bad',
            type: 'function',
            function: { name: 'nonexistent_tool', arguments: '{}' },
          },
        ],
      })
      .mockResolvedValueOnce({
        content: 'I encountered an error.',
        finish_reason: 'stop',
      });

    const result = await agent.run('Do something weird');
    expect(result).toBe('I encountered an error.');
  });

  it('resets history correctly', async () => {
    mockChat.mockResolvedValue({ content: 'Hello!', finish_reason: 'stop' });
    await agent.run('First message');
    agent.resetHistory();
    await agent.run('Second message');
    // After reset, only system + second user message should be in context
    const secondCallArgs = mockChat.mock.calls[1][0] as Array<{ role: string; content: string }>;
    const userMessages = secondCallArgs.filter(m => m.role === 'user');
    expect(userMessages.length).toBe(1);
    expect(userMessages[0].content).toBe('Second message');
  });
});
