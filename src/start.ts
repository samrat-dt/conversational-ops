/**
 * Combined entry point for Railway deployment.
 * Starts both the Express API server and the Slack bot in the same process.
 */
import 'dotenv/config';
import { App } from '@slack/bolt';
import { registerHandlers } from './slack/handler.js';
import { getMappedChannels } from './slack/channel-map.js';
import { createServer } from './server/index.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function main() {
  // Start Express API server
  const expressApp = createServer();
  await new Promise<void>(resolve => { expressApp.listen(PORT, () => resolve()); });
  console.log(`[Server] API running on port ${PORT}`);

  // Start Slack bot (only if tokens are present)
  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
    const slackApp = new App({
      token: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      socketMode: true,
    });
    registerHandlers(slackApp);
    await slackApp.start();

    const channels = getMappedChannels();
    console.log(`[Slack] Bot connected. Monitoring: ${channels.map(c => `#${c}`).join(', ')}`);
  } else {
    console.log('[Slack] Skipped — SLACK_BOT_TOKEN or SLACK_APP_TOKEN not set');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
