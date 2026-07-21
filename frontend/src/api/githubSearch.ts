import { apiClient } from "../lib/apiClient";

export type RepoSearchSource = "installed" | "public";

export interface GithubSearchOwner {
  login: string;
  avatar_url?: string | null;
}

export interface GithubSearchItem {
  id: number;
  full_name: string;
  html_url: string;
  description?: string | null;
  stargazers_count: number;
  language?: string | null;
  updated_at?: string | null;
  owner: GithubSearchOwner;
  // CodeBuster-specific
  is_connected?: boolean | null;
  connected_repo_id?: string | null;
  installation_id?: number | null;
}

export interface InstalledReposResponse {
  items: GithubSearchItem[];
  page: number;
  per_page: number;
  total_estimate: number;
  source: "installed";
}

export interface PublicReposResponse {
  items: GithubSearchItem[];
  page: number;
  per_page: number;
  total_count: number;
  source: "public";
}

export interface SearchParams {
  query: string;
  page?: number;
  per_page?: number;
}

export async function searchInstalledRepos(
  params: SearchParams
): Promise<InstalledReposResponse> {
  const { query, page = 1, per_page = 20 } = params;
  const sp = new URLSearchParams();
  if (query) sp.set("query", query);
  sp.set("page", String(page));
  sp.set("per_page", String(per_page));
  const q = sp.toString();
  return apiClient.get(`/api/github/installed-repos${q ? `?${q}` : ""}`) as Promise<
    InstalledReposResponse
  >;
}

export async function searchPublicRepos(
  params: SearchParams
): Promise<PublicReposResponse> {
  const { query, page = 1, per_page = 20 } = params;
  const sp = new URLSearchParams();
  if (query) sp.set("query", query);
  sp.set("page", String(page));
  sp.set("per_page", String(per_page));
  const q = sp.toString();
  return apiClient.get(`/api/github/public-repos${q ? `?${q}` : ""}`) as Promise<
    PublicReposResponse
  >;
}

