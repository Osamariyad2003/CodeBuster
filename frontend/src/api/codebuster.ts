/**
 * Typed API client for CodeBuster backend.
 * Uses relative URLs so requests go through the Vite proxy (same-origin),
 * avoiding CORS and cookie issues with cross-origin direct requests.
 */

const BASE = "";

export interface Repo {
  id: string;
  full_name: string;
  default_branch?: string;
}

export interface RepoHealth {
  repo_id: string;
  full_name: string;
  latest_score?: number;
  latest_grade?: string;
  latest_review_id?: string;
}

export interface RepoSettings {
  repo_id: string;
  enabled_analyzers: string[];
  min_severity: string;
  fail_pr_on_grade_below: string;
}

export interface Review {
  id: string;
  repo_id: string;
  repo_name?: string;
  overall_score?: number;
  overall_grade?: string;
  status?: string;
  created_at: string;
  completed_at?: string;
}

export interface ReviewList {
  reviews: Review[];
  total: number;
}

export interface Finding {
  id: string;
  severity: string;
  category?: string;
  confidence?: number;
  file?: string;
  start_line?: number;
  end_line?: number;
  message?: string;
}

export interface ExecutiveSummary {
  executive_summary?: string;
  top_risks_narrative?: Array<{ title: string; why_it_matters: string }>;
  fix_priority_order?: Array<{ issue_index: number; rationale: string }>;
  production_readiness?: "yes" | "with_caveats" | "no";
  production_readiness_rationale?: string;
}

export interface AIStats {
  attempted: number;
  enhanced: number;
  failed: number;
  cache_hits: number;
  provider: string | null;
  top_n: number;
}

export interface ReviewDetail {
  id: string;
  repo_id: string;
  overall_score?: number;
  overall_grade?: string;
  category_scores?: Array<{ key: string; label: string; score: number }>;
  findings?: Finding[];
  canonical_payload?: Record<string, unknown>;
  // Backend packs the AI-generated executive summary + per-run AI stats
  // into extra_metadata alongside the analysis metadata. Both optional —
  // null when AI is unavailable.
  extra_metadata?: {
    executive_summary?: ExecutiveSummary;
    ai_stats?: AIStats;
    [key: string]: unknown;
  };
  created_at: string;
  completed_at?: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 30_000
): Promise<T> {
  const url = BASE ? `${BASE.replace(/\/$/, "")}${path}` : path;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include",
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Request timed out — please try again");
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const err: any = new Error(res.statusText);
    err.status = res.status;
    err.body = await res.text();
    throw err;
  }
  return res.json() as Promise<T>;
}

export const codebusterApi = {
  health: () => request<{ status: string }>("/health"),

  getRepos: async (): Promise<Repo[]> => {
    const data = await request<Repo[] | { repos?: Repo[] }>("/api/repos");
    return Array.isArray(data) ? data : (data?.repos ?? []);
  },

  getRepoHealth: (repoId: string): Promise<RepoHealth> =>
    request<RepoHealth>(`/api/repos/${repoId}/health`),

  getRepoSettings: (repoId: string): Promise<RepoSettings> =>
    request<RepoSettings>(`/api/repos/${repoId}/settings`),

  updateRepoSettings: (
    repoId: string,
    body: Partial<Pick<RepoSettings, "enabled_analyzers" | "min_severity" | "fail_pr_on_grade_below">>
  ): Promise<RepoSettings> =>
    request<RepoSettings>(`/api/repos/${repoId}/settings`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  getReviews: (params?: { page?: number; page_size?: number }): Promise<ReviewList> => {
    const sp = new URLSearchParams();
    if (params?.page != null) sp.set("page", String(params.page));
    if (params?.page_size != null) sp.set("page_size", String(params.page_size));
    const q = sp.toString();
    return request<ReviewList>(`/api/reviews${q ? `?${q}` : ""}`);
  },

  getReview: (
    reviewId: string,
    params?: { severity?: string; category?: string }
  ): Promise<ReviewDetail> => {
    const sp = new URLSearchParams();
    if (params?.severity) sp.set("severity", params.severity);
    if (params?.category) sp.set("category", params.category);
    const q = sp.toString();
    return request<ReviewDetail>(`/api/reviews/${reviewId}${q ? `?${q}` : ""}`);
  },
};
