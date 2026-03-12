import type { App } from '@slack/bolt';
import { loadConfig } from '../config/loader.js';
import { Agent } from '../agent/index.js';
import { LLMClient } from '../llm/client.js';
import { getConfigPath } from './channel-map.js';

// Use unknown cast to avoid version conflicts between bolt's bundled web-api and ours
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// Per-channel agent instances persist conversation history within the process lifetime
const agentCache = new Map<string, Agent>();

function getAgent(channelName: string, configPath: string): Agent {
  if (!agentCache.has(channelName)) {
    const config = loadConfig(configPath);
    agentCache.set(channelName, new Agent(config));
  }
  return agentCache.get(channelName)!;
}

/** Fast LLM check: is this message an ops action or just conversation? */
async function isOpsAction(text: string, pipelineName: string): Promise<boolean> {
  const llm = new LLMClient();
  const response = await llm.chat([
    {
      role: 'system',
      content: `You are a classifier for the "${pipelineName}" pipeline. Respond with ONLY "yes" or "no".
Is the following message an ops action (create/update/list/report/log/calculate) or just casual conversation?
Ops actions include: adding items, updating stages, logging calls/meetings, asking for reports, listing items, calculating metrics.
Casual conversation includes: greetings, off-topic chat, questions about unrelated topics.`,
    },
    { role: 'user', content: text },
  ]);
  return (response.content ?? '').toLowerCase().trim().startsWith('yes');
}

export function registerHandlers(app: App): void {
  app.message(async ({ message, client, say }) => {
    // Only handle real user messages (not bot messages, edits, deletes)
    if (message.subtype !== undefined) return;
    const msg = message as { text?: string; channel: string; ts: string; thread_ts?: string; user?: string };

    const text = msg.text?.trim();
    if (!text) return;

    // Resolve channel name from ID
    let channelName: string;
    try {
      const info = await (client as AnyClient).conversations.info({ channel: msg.channel });
      channelName = (info.channel as { name?: string })?.name ?? '';
    } catch {
      return; // Can't resolve channel, skip
    }

    const configPath = getConfigPath(channelName);
    if (!configPath) return; // Channel not in our map — ignore silently

    // Load config just for the pipeline name (cached by agent)
    let pipelineName = channelName;
    try {
      const cfg = loadConfig(configPath);
      pipelineName = cfg.name;
    } catch {
      // Use channel name as fallback
    }

    // Intent classification — is this an ops action?
    let isAction: boolean;
    try {
      isAction = await isOpsAction(text, pipelineName);
    } catch {
      isAction = true; // On classification failure, attempt to process
    }

    if (!isAction) {
      // React with 👀 to show the bot saw it but it's not an action
      try {
        await (client as AnyClient).reactions.add({
          channel: msg.channel,
          timestamp: msg.ts,
          name: 'eyes',
        });
      } catch {
        // Reactions may fail if bot lacks permission — that's fine
      }
      return;
    }

    // Show "typing" indicator while processing
    try {
      await (client as AnyClient).reactions.add({
        channel: msg.channel,
        timestamp: msg.ts,
        name: 'hourglass_flowing_sand',
      });
    } catch { /* ok */ }

    // Run the agent
    const agent = getAgent(channelName, configPath);
    let response: string;
    try {
      response = await agent.run(text);
    } catch (err: unknown) {
      response = `Error: ${(err as Error).message}`;
    }

    // Remove hourglass, post response in thread
    try {
      await (client as AnyClient).reactions.remove({
        channel: msg.channel,
        timestamp: msg.ts,
        name: 'hourglass_flowing_sand',
      });
    } catch { /* ok */ }

    await say({
      text: response,
      thread_ts: msg.thread_ts ?? msg.ts, // reply in thread
    });
  });

  // Handle /reset slash command to clear agent history for a channel
  app.command('/ops-reset', async ({ ack, respond, command }) => {
    await ack();
    let channelName: string;
    try {
      const info = await (command as unknown as { client: AnyClient }).client?.conversations.info({ channel: command.channel_id });
      channelName = (info?.channel as { name?: string })?.name ?? '';
    } catch {
      channelName = '';
    }
    if (channelName && agentCache.has(channelName)) {
      agentCache.get(channelName)!.resetHistory();
      await respond('Conversation history cleared for this channel.');
    } else {
      await respond('No active session to reset.');
    }
  });
}
