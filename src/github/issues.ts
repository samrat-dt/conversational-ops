import { getOctokit } from './client.js';

export interface IssueData {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: string[];
  assignees: string[];
  created_at: string;
  updated_at: string;
  html_url: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeIssue(issue: any): GitHubIssue {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? null,
    state: issue.state,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    labels: (issue.labels as any[]).map((l: any) => (typeof l === 'string' ? l : (l.name ?? ''))).filter(Boolean),
    assignees: ((issue.assignees as Array<{ login?: string } | null> | null) ?? []).map(a => (a && typeof a === 'object' ? (a.login ?? '') : '')).filter(Boolean),
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    html_url: issue.html_url,
  };
}

export async function createIssue(data: IssueData): Promise<GitHubIssue> {
  const octokit = getOctokit();
  const { data: issue } = await octokit.issues.create({
    owner: data.owner,
    repo: data.repo,
    title: data.title,
    body: data.body,
    labels: data.labels,
    assignees: data.assignees,
  });
  return normalizeIssue(issue);
}

export async function updateIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  updates: { title?: string; body?: string; state?: 'open' | 'closed'; labels?: string[]; assignees?: string[] }
): Promise<GitHubIssue> {
  const octokit = getOctokit();
  const { data: issue } = await octokit.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    ...updates,
  });
  return normalizeIssue(issue);
}

export async function listIssues(
  owner: string,
  repo: string,
  options: { labels?: string; state?: 'open' | 'closed' | 'all'; assignee?: string; per_page?: number } = {}
): Promise<GitHubIssue[]> {
  const octokit = getOctokit();
  const { data } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: options.state ?? 'open',
    labels: options.labels,
    assignee: options.assignee,
    per_page: options.per_page ?? 100,
  });
  return data.map(normalizeIssue);
}

export async function getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
  const octokit = getOctokit();
  const { data } = await octokit.issues.get({ owner, repo, issue_number: issueNumber });
  return normalizeIssue(data);
}
