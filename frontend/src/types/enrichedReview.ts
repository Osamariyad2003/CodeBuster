/**
 * Enriched review schema: SonarQube + Awesome-Linters + Claude AI.
 * Connects to EXISTING_UI_COMPONENTS (e.g. ReviewDetailPage, IssueTable) by
 * mapping issue_list to a display-friendly shape.
 */

export interface LinterReference {
  linter_name: string;
  linter_rule_id: string;
  linter_rule_desc: string;
}

export interface EnrichedIssue {
  issue_id: string;
  rule: string;
  severity: string;
  file: string;
  line: number;
  description: string;
  recommended_fix: string;
  code_snippet?: string;
  suggested_fix?: {
    content: string;
  };
  effort_minutes: number;
  linters_reference: LinterReference[];
  tags: string[];
}

export interface EnrichedReviewResponse {
  project: string;
  scan_source: string;
  issue_list: EnrichedIssue[];
}
