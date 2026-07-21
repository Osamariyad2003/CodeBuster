import { apiClient } from "../lib/apiClient";
import type { GerritCommitsResponse } from "../types/gerrit";

export async function fetchGerritCommits(repoId?: string): Promise<GerritCommitsResponse> {
  const url = repoId
    ? `/api/gerrit/commits?repo_id=${encodeURIComponent(repoId)}`
    : "/api/gerrit/commits";
  const data = await apiClient.get(url);
  return data as GerritCommitsResponse;
}

export async function runGerritReview(
  repoId: string,
  commitSha?: string
): Promise<{
  success: boolean;
  message?: string;
  job_id?: string;
  review_id?: string;
  idempotent?: boolean;
  inline?: boolean;
}> {
  const body: Record<string, string> = { repo_id: repoId };
  if (commitSha) body.commit_sha = commitSha;
  const data = await apiClient.post("/api/gerrit/run", body);
  return data as any;
}
