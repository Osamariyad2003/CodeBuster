/** Gerrit commit review (Inbox) types */

export interface GerritCommitReview {
  id: string;
  title: string;
  owner?: string;
  repo_ref: string;
  repo_id?: string;
  status?: string;
  category: string;
  reviewers_count?: number;
  ci_passed?: number;
  ci_failed?: number;
  lines_added?: number;
  lines_removed?: number;
  age?: string;
  html_url?: string;
  review_id?: string;
  health_score?: number;
}

export interface GerritCategory {
  id: string;
  label: string;
  count: number;
}

export interface GerritCommitsResponse {
  categories: GerritCategory[];
  commits: GerritCommitReview[];
}
