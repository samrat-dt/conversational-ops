import { getOctokit } from './client.js';

export async function ensureLabel(
  owner: string,
  repo: string,
  labelName: string,
  color = 'ededed',
  description = ''
): Promise<void> {
  const octokit = getOctokit();
  try {
    await octokit.issues.getLabel({ owner, repo, name: labelName });
  } catch (err: unknown) {
    const error = err as { status?: number };
    if (error.status === 404) {
      await octokit.issues.createLabel({ owner, repo, name: labelName, color, description });
    } else {
      throw err;
    }
  }
}

export async function applyLabel(
  owner: string,
  repo: string,
  issueNumber: number,
  labelName: string
): Promise<void> {
  const octokit = getOctokit();
  await octokit.issues.addLabels({ owner, repo, issue_number: issueNumber, labels: [labelName] });
}

export async function removeLabel(
  owner: string,
  repo: string,
  issueNumber: number,
  labelName: string
): Promise<void> {
  const octokit = getOctokit();
  try {
    await octokit.issues.removeLabel({ owner, repo, issue_number: issueNumber, name: labelName });
  } catch (err: unknown) {
    const error = err as { status?: number };
    // 404 means label wasn't on the issue — that's fine
    if (error.status !== 404) throw err;
  }
}

export async function ensureAllStageLabels(
  owner: string,
  repo: string,
  stageLabels: string[]
): Promise<void> {
  await Promise.all(stageLabels.map(label => ensureLabel(owner, repo, label)));
}
