import { getOctokit } from './client.js';

export interface IssueComment {
  id: number;
  body: string;
  created_at: string;
  user: string;
}

export async function addComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<IssueComment> {
  const octokit = getOctokit();
  const { data } = await octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body });
  return {
    id: data.id,
    body: data.body ?? '',
    created_at: data.created_at,
    user: data.user?.login ?? '',
  };
}

export async function listComments(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<IssueComment[]> {
  const octokit = getOctokit();
  const { data } = await octokit.issues.listComments({ owner, repo, issue_number: issueNumber });
  return data.map(c => ({
    id: c.id,
    body: c.body ?? '',
    created_at: c.created_at,
    user: c.user?.login ?? '',
  }));
}
