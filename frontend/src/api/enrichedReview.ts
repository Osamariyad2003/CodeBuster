/**
 * Enriched review workflow: fetch SonarQube scan, enrich with Claude (Awesome-Linters).
 * Uses EXISTING_UI: apiClient from lib/apiClient.js for auth and error handling.
 * Placeholders: VITE_SONARQUBE_API_URL, backend /api/reviews/enrich (holds CLAUDE_API_KEY server-side).
 */

import { apiClient } from "../lib/apiClient";
import type { EnrichedReviewResponse } from "../types/enrichedReview";

const SONARQUBE_API_URL =
  (import.meta as any).env?.VITE_SONARQUBE_API_URL ?? "";
const ENRICH_ENDPOINT = "/api/reviews/enrich";

/** Raw SonarQube issue shape (partial); backend or Claude normalizes to EnrichedIssue. */
export interface SonarQubeIssueLike {
  key?: string;
  rule?: string;
  severity?: string;
  component?: string;
  line?: number;
  message?: string;
  textRange?: { startLine: number };
  [k: string]: any;
}

/**
 * Fetch scan JSON from backend proxy or direct SONARQUBE_API_URL.
 * Backend should proxy to avoid CORS and keep tokens server-side.
 */
export async function fetchSonarQubeScan(
  repoId?: string
): Promise<{ issues?: SonarQubeIssueLike[]; [k: string]: any }> {
  if (repoId) {
    const data = await apiClient.get(
      `/api/sonar/scan?repo_id=${encodeURIComponent(repoId)}`
    );
    return data as { issues?: SonarQubeIssueLike[]; [k: string]: any };
  }
  if (SONARQUBE_API_URL) {
    const res = await fetch(SONARQUBE_API_URL, { credentials: "omit" });
    if (!res.ok) throw new Error(`SonarQube fetch failed: ${res.status}`);
    return res.json();
  }
  return { issues: [] };
}

/**
 * Send raw issues to backend; backend uses Claude API (CLAUDE_API_KEY) to enrich
 * with Awesome-Linters mapping and returns EnrichedReviewResponse.
 * Payload is built from primitives only to avoid "Converting circular structure to JSON"
 * (e.g. never pass event or DOM nodes).
 */
export async function enrichIssuesWithClaude(payload: {
  project: string;
  raw_issues: SonarQubeIssueLike[];
}): Promise<EnrichedReviewResponse> {
  const { project, raw_issues } = payload;
  const safePayload = {
    project: typeof project === "string" ? project : "codebuster",
    raw_issues: Array.isArray(raw_issues)
      ? raw_issues.map((issue) => ({
          key: issue?.key,
          rule: issue?.rule,
          severity: issue?.severity,
          component: issue?.component,
          line: issue?.line,
          message: issue?.message,
          textRange:
            issue?.textRange && typeof issue.textRange === "object"
              ? { startLine: issue.textRange.startLine }
              : undefined,
        }))
      : [],
  };
  const data = await apiClient.post(ENRICH_ENDPOINT, safePayload);
  return data as EnrichedReviewResponse;
}

/**
 * Full workflow: fetch scan then enrich. Async; handle errors in caller.
 */
export async function runEnrichedReview(params: {
  repoId?: string;
  project?: string;
  sonarJson?: { issues?: SonarQubeIssueLike[]; [k: string]: any };
}): Promise<EnrichedReviewResponse> {
  const { repoId, project = "codebuster", sonarJson } = params;
  const scan = sonarJson ?? (await fetchSonarQubeScan(repoId));
  const rawIssues = scan?.issues ?? [];
  return enrichIssuesWithClaude({ project, raw_issues: rawIssues });
}
