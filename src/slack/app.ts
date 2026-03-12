import 'dotenv/config';
import { App } from '@slack/bolt';
import { registerHandlers } from './handler.js';
import { getMappedChannels } from './channel-map.js';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

registerHandlers(app);

async function start(): Promise<void> {
  await app.start();

  const channels = getMappedChannels();
  console.log('='.repeat(50));
  console.log(' conversational-ops Slack Bot (Socket Mode)');
  console.log('='.repeat(50));
  console.log('Monitoring channels:');
  channels.forEach(c => console.log(`  • #${c}`));
  console.log('');
  console.log('Bot reads ALL messages in these channels.');
  console.log('Actions → agent runs + thread reply.');
  console.log('Casual → 👀 reaction only.');
  console.log('='.repeat(50));
}

start().catch(err => {
  console.error('Fatal error starting Slack bot:', err);
  process.exit(1);
});
