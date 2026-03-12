/**
 * Maps Slack channel names/IDs to pipeline config files.
 *
 * Two ways to configure:
 *   1. Env var CHANNEL_MAP (recommended for Railway):
 *      CHANNEL_MAP=sales-ops:sales,hiring-ops:hiring,cs-ops:customer-success
 *
 *   2. Default name-based mapping (works if channel names match convention):
 *      #sales-ops      → templates/sales.yaml
 *      #hiring-ops     → templates/hiring.yaml
 *      #cs-ops         → templates/customer-success.yaml
 *      #investor-ops   → templates/investor.yaml
 *      #partnerships-ops → templates/partnership.yaml
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

// Default channel-name → template-filename mapping
const DEFAULT_MAP: Record<string, string> = {
  'sales-ops': 'sales',
  'hiring-ops': 'hiring',
  'cs-ops': 'customer-success',
  'investor-ops': 'investor',
  'partnerships-ops': 'partnership',
};

function buildMap(): Map<string, string> {
  const map = new Map<string, string>();

  const envMap = process.env.CHANNEL_MAP;
  if (envMap) {
    // Parse "channel-name:template,channel-name:template"
    for (const pair of envMap.split(',')) {
      const [channel, template] = pair.trim().split(':');
      if (channel && template) {
        map.set(channel.trim(), path.join(TEMPLATES_DIR, `${template.trim()}.yaml`));
      }
    }
  } else {
    for (const [channel, template] of Object.entries(DEFAULT_MAP)) {
      map.set(channel, path.join(TEMPLATES_DIR, `${template}.yaml`));
    }
  }

  return map;
}

export const channelMap = buildMap();

/** Returns the config file path for a given channel name, or null if not mapped. */
export function getConfigPath(channelName: string): string | null {
  return channelMap.get(channelName) ?? null;
}

/** Returns all mapped channel names. */
export function getMappedChannels(): string[] {
  return Array.from(channelMap.keys());
}
