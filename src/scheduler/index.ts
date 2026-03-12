import 'dotenv/config';
import type { PipelineConfig } from '../config/types.js';
import { listIssues } from '../github/issues.js';
import { addComment } from '../github/comments.js';
import { applyLabel, ensureLabel } from '../github/labels.js';

const STALE_LABEL = 'stale';

export async function runStalenessCheck(config: PipelineConfig): Promise<void> {
  if (!config.staleness) {
    console.log('No staleness config defined. Skipping.');
    return;
  }

  const { days, action, message } = config.staleness;
  const { owner, repo } = config.github;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const issues = await listIssues(owner, repo, { state: 'open' });
  const staleIssues = issues.filter(i => new Date(i.updated_at).getTime() < cutoff);

  console.log(`Staleness check: ${staleIssues.length} of ${issues.length} open items stale (>${days} days inactive)`);

  for (const issue of staleIssues) {
    const daysSince = Math.floor((Date.now() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    console.log(`  #${issue.number}: "${issue.title}" (${daysSince} days since last update)`);

    if (action === 'comment') {
      await addComment(owner, repo, issue.number, `⏰ **Staleness Alert** — ${message}\n\n_Last updated: ${issue.updated_at}_`);
    } else if (action === 'label') {
      await ensureLabel(owner, repo, STALE_LABEL, 'ededed', 'No recent activity');
      await applyLabel(owner, repo, issue.number, STALE_LABEL);
    }
  }

  console.log('Staleness check complete.');
}

/** Run the staleness check on an interval (milliseconds). */
export function scheduleCheck(config: PipelineConfig, intervalMs: number): NodeJS.Timer {
  console.log(`Scheduler: running staleness check every ${intervalMs / 1000 / 60} minutes`);
  runStalenessCheck(config).catch(console.error); // run immediately
  return setInterval(() => runStalenessCheck(config).catch(console.error), intervalMs);
}
