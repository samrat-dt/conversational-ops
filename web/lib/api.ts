const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface PipelineConfigMeta {
  id: string;
  name: string;
}

export interface PipelineItem {
  number: number;
  title: string;
  labels: string[];
  assignees: string[];
  updated_at: string;
  html_url: string;
}

export interface Stage {
  name: string;
  label: string;
  probability?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

export async function fetchConfigs(): Promise<PipelineConfigMeta[]> {
  const res = await fetch(`${API_URL}/api/configs`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch configs');
  return res.json() as Promise<PipelineConfigMeta[]>;
}

export async function fetchItems(config: string, stage?: string): Promise<{ items: PipelineItem[]; stages: Stage[] }> {
  const url = new URL(`${API_URL}/api/pipeline/${config}/items`);
  if (stage) url.searchParams.set('stage', stage);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch items');
  return res.json() as Promise<{ items: PipelineItem[]; stages: Stage[] }>;
}

export async function* streamChat(
  message: string,
  config: string,
  sessionId: string
): AsyncGenerator<{ type: 'status' | 'message' | 'error' | 'done'; text?: string }> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, config, sessionId }),
  });

  if (!res.ok || !res.body) {
    yield { type: 'error', text: 'Failed to connect to API' };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    let currentEvent = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6)) as { text?: string };
          if (currentEvent === 'message' || currentEvent === 'status' || currentEvent === 'error') {
            yield { type: currentEvent as 'message' | 'status' | 'error', text: data.text };
          } else if (currentEvent === 'done') {
            yield { type: 'done' };
          }
        } catch { /* ignore parse errors */ }
      }
    }
  }
}

export async function resetSession(config: string, sessionId: string): Promise<void> {
  await fetch(`${API_URL}/api/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, sessionId }),
  });
}
