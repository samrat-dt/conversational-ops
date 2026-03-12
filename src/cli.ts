#!/usr/bin/env node
import 'dotenv/config';
import readline from 'readline';
import { loadConfig } from './config/loader.js';
import { Agent } from './agent/index.js';

function parseArgs(argv: string[]): { config?: string; run?: string } {
  const result: { config?: string; run?: string } = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--config' && argv[i + 1]) result.config = argv[++i];
    else if (argv[i] === '--run' && argv[i + 1]) result.run = argv[++i];
  }
  return result;
}

async function singleShot(agent: Agent, input: string): Promise<void> {
  const response = await agent.run(input);
  console.log(response);
}

async function repl(agent: Agent, configName: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   Conversational Ops — ${configName.padEnd(18)}║`);
  console.log(`╠══════════════════════════════════════════╣`);
  console.log(`║  Type your command or "exit" to quit     ║`);
  console.log(`║  Type "help" to see available actions    ║`);
  console.log(`║  Type "reset" to clear history           ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  const prompt = () => {
    rl.question('> ', async (input) => {
      const trimmed = input.trim();
      if (!trimmed) { prompt(); return; }

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log('Goodbye!');
        rl.close();
        return;
      }

      if (trimmed.toLowerCase() === 'reset') {
        agent.resetHistory();
        console.log('Conversation history cleared.\n');
        prompt();
        return;
      }

      try {
        process.stdout.write('\n');
        const response = await agent.run(trimmed);
        console.log('\n' + response + '\n');
      } catch (err: unknown) {
        console.error(`Error: ${(err as Error).message}\n`);
      }

      prompt();
    });
  };

  rl.on('close', () => process.exit(0));
  prompt();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!args.config) {
    console.error('Usage: npx tsx src/cli.ts --config <path-to-config.yaml> [--run "<command>"]');
    console.error('\nExample:');
    console.error('  npx tsx src/cli.ts --config templates/sales.yaml');
    console.error('  npx tsx src/cli.ts --config templates/hiring.yaml --run "Add candidate Jane Doe"');
    process.exit(1);
  }

  let config;
  try {
    config = loadConfig(args.config);
  } catch (err: unknown) {
    console.error(`Failed to load config: ${(err as Error).message}`);
    process.exit(1);
  }

  const agent = new Agent(config);

  if (args.run) {
    await singleShot(agent, args.run);
  } else {
    await repl(agent, config.name);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
