import { apiClient } from '../lib/apiClient';

export interface CategoryScore {
  key: string;
  label: string;
  score: number;
  weight?: number | null;
}

export interface FixFirstItem {
  id: string;
  title: string;
  why: string;
  owner_hint?: string | null;
  effort: 'S' | 'M' | 'L';
  related_finding_ids: string[];
  status: 'pending' | 'in_progress' | 'done';
}

export interface ReviewSummary {
  review_id: string;
  repository_id: string;
  repo_full_name: string;
  commit_sha: string;
  trigger_source: string;
  created_at?: string | null;
  overall_score: number;
  overall_grade: string;
  production_readiness?: string | null;
}

export interface LatestReviewResponse {
  review: ReviewSummary | null;
  categories: CategoryScore[];
  top_issues: any[];
  fix_first: FixFirstItem[];
}

export interface CanonicalReview {
  project: Record<string, unknown>;
  trigger: Record<string, unknown>;
  scores: {
    overall_score: number;
    overall_grade: string;
    production_readiness: string;
    categories: CategoryScore[];
  };
  findings: any[];
  fix_first: FixFirstItem[];
  summary: Record<string, unknown>;
  analyzers: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export async function getLatestReviewV1(repoId: string): Promise<LatestReviewResponse> {
  return apiClient.get(`/api/v1/repos/${repoId}/reviews/latest`);
}

export async function getReviewCanonicalV1(reviewId: string): Promise<CanonicalReview> {
  return apiClient.get(`/api/v1/reviews/${reviewId}`);
}

