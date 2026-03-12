'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { streamChat, resetSession } from '@/lib/api';
import type { ChatMessage } from '@/lib/api';

// Stable session ID per browser tab
function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = sessionStorage.getItem('ops-session-id');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('ops-session-id', id);
  }
  return id;
}

const SUGGESTIONS: Record<string, string[]> = {
  sales:    ['List all open deals', 'Show pipeline report', 'Add deal "Acme Corp" $50k at Demo stage'],
  hiring:   ['List all candidates', 'Add candidate Jane Doe, Senior Engineer, LinkedIn', 'Show hiring report'],
  'customer-success': ['List at-risk accounts', 'Show CS dashboard', 'Flag accounts inactive 14 days'],
  investor: ['List all investors', 'Show fundraise dashboard', 'Add investor "Sequoia" at First Meeting stage'],
  partnership: ['List active partners', 'Show partnership report', 'Add partner "Stripe" at Discovery stage'],
};

interface ChatPanelProps {
  pipelineId: string;
  pipelineName: string;
}

export function ChatPanel({ pipelineId, pipelineName }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionId = useRef(getSessionId());

  // Welcome message on mount / pipeline change
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: `Connected to **${pipelineName}**. Type a command or pick a suggestion below.\n\nTry: _"${SUGGESTIONS[pipelineId]?.[0] ?? 'Show pipeline report'}"_`,
      timestamp: new Date(),
    }]);
    inputRef.current?.focus();
  }, [pipelineId, pipelineName]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusText]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);
    setStatusText('Thinking...');

    let assistantContent = '';

    try {
      for await (const event of streamChat(text.trim(), pipelineId, sessionId.current)) {
        if (event.type === 'status') {
          setStatusText(event.text ?? '');
        } else if (event.type === 'message') {
          assistantContent = event.text ?? '';
          setStatusText('');
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: assistantContent, timestamp: new Date() },
          ]);
        } else if (event.type === 'error') {
          setStatusText('');
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: `Error: ${event.text}`, timestamp: new Date() },
          ]);
        } else if (event.type === 'done') {
          setStatusText('');
        }
      }
    } finally {
      setIsStreaming(false);
      setStatusText('');
      inputRef.current?.focus();
    }
  }, [pipelineId, isStreaming]);

  const handleReset = async () => {
    await resetSession(pipelineId, sessionId.current);
    setMessages([{
      role: 'assistant',
      content: 'Conversation history cleared.',
      timestamp: new Date(),
    }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const suggestions = SUGGESTIONS[pipelineId] ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 flex-shrink-0">
        <div>
          <h1 className="text-sm font-bold text-zinc-100">{pipelineName}</h1>
          <p className="text-xs text-zinc-500">GitHub Issues · Groq LLM</p>
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded border border-zinc-700 hover:border-zinc-500"
        >
          reset
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {/* Streaming status */}
        {isStreaming && statusText && (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <span className="animate-pulse">◆</span>
            <span>{statusText}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions (shown when no messages beyond welcome) */}
      {messages.length <= 1 && suggestions.length > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-5 pb-5 pt-2 flex-shrink-0 border-t border-zinc-800">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${pipelineName}...`}
            rows={2}
            disabled={isStreaming}
            className="flex-1 resize-none bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-600 transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm rounded-lg transition-colors font-medium flex-shrink-0"
          >
            Send
          </button>
        </div>
        <p className="text-zinc-600 text-xs mt-2">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  // Very minimal markdown-to-HTML: **bold**, _italic_, links, newlines, code blocks
  const renderContent = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-zinc-800 px-1 py-0.5 rounded text-emerald-300 text-xs">$1</code>')
      .replace(/\n/g, '<br />');
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-emerald-900/50 text-zinc-100 border border-emerald-800/50'
            : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700/50'
        }`}
      >
        {!isUser && (
          <div className="text-xs text-emerald-400 mb-1 font-medium">agent</div>
        )}
        <div dangerouslySetInnerHTML={{ __html: renderContent(message.content) }} />
        <div className="text-xs text-zinc-600 mt-1.5">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
