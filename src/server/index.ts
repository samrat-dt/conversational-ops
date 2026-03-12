/**
 * Express API server — serves the web UI and provides REST endpoints.
 * Runs alongside the Slack bot in the same Railway process.
 *
 * Routes:
 *   GET  /api/configs                      → list available pipeline configs
 *   GET  /api/pipeline/:config/items       → list GitHub issues for a pipeline
 *   POST /api/chat                         → run agent (SSE streaming)
 *   POST /api/reset                        → clear session history
 *   GET  /health                           → health check
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { loadConfig } from '../config/loader.js';
import { Agent } from '../agent/index.js';
import { listIssues } from '../github/issues.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// Session store: sessionId → Agent instance (in-memory, per-process)
const sessions = new Map<string, Agent>();

function getOrCreateSession(sessionId: string, configName: string): Agent {
  const key = `${sessionId}:${configName}`;
  if (!sessions.has(key)) {
    const configPath = path.join(TEMPLATES_DIR, `${configName}.yaml`);
    const config = loadConfig(configPath);
    sessions.set(key, new Agent(config));
  }
  return sessions.get(key)!;
}

function listTemplates(): Array<{ id: string; name: string }> {
  return fs
    .readdirSync(TEMPLATES_DIR)
    .filter(f => f.endsWith('.yaml'))
    .map(f => {
      const id = f.replace('.yaml', '');
      try {
        const config = loadConfig(path.join(TEMPLATES_DIR, f));
        return { id, name: config.name };
      } catch {
        return { id, name: id };
      }
    });
}

export function createServer(): express.Application {
  const app = express();

  app.use(cors({ origin: process.env.WEB_ORIGIN ?? '*' }));
  app.use(express.json());

  // Health check
  app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // List available pipeline configs
  app.get('/api/configs', (_, res) => {
    try {
      res.json(listTemplates());
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // List items for a pipeline
  app.get('/api/pipeline/:config/items', async (req, res) => {
    const { config } = req.params;
    const { stage, state = 'open' } = req.query as { stage?: string; state?: string };
    try {
      const configPath = path.join(TEMPLATES_DIR, `${config}.yaml`);
      const pipelineConfig = loadConfig(configPath);
      const stageLabel = stage
        ? pipelineConfig.stages.find(s => s.name.toLowerCase() === stage.toLowerCase())?.label
        : undefined;
      const items = await listIssues(pipelineConfig.github.owner, pipelineConfig.github.repo, {
        labels: stageLabel,
        state: state as 'open' | 'closed' | 'all',
      });
      res.json({ items, stages: pipelineConfig.stages });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Chat endpoint — SSE streaming
  app.post('/api/chat', async (req, res) => {
    const { message, config, sessionId } = req.body as {
      message: string;
      config: string;
      sessionId: string;
    };

    if (!message || !config || !sessionId) {
      return res.status(400).json({ error: 'message, config, and sessionId are required' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      send('status', { text: 'Thinking...' });
      const agent = getOrCreateSession(sessionId, config);
      const response = await agent.run(message);
      send('message', { text: response });
      send('done', {});
    } catch (err: unknown) {
      send('error', { text: (err as Error).message });
    } finally {
      res.end();
    }
  });

  // Reset session history
  app.post('/api/reset', (req, res) => {
    const { config, sessionId } = req.body as { config: string; sessionId: string };
    const key = `${sessionId}:${config}`;
    if (sessions.has(key)) {
      sessions.get(key)!.resetHistory();
      sessions.delete(key);
    }
    res.json({ ok: true });
  });

  return app;
}

// Start standalone if this is the entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createServer();
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
}
