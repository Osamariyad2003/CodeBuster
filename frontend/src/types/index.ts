/**
 * CodeBuster Frontend - TypeScript Type Definitions
 * 
 * This file contains all TypeScript interfaces and types used throughout the frontend.
 */

// ============================================================================
// Core Types
// ============================================================================

export interface Repo {
  id: string;
  full_name: string;
  owner: string;
  name: string;
  description?: string;
  language?: string;
  is_private: boolean;
  default_branch: string;
  connected_at: string;
  status: 'active' | 'paused' | 'disconnected';
}

export interface AnalysisRun {
  id: string;
  repository_id: string;
  pr_number?: number;
  commit_sha?: string;
  branch?: string;
  trigger_type: 'webhook' | 'manual' | 'scheduled';
  status: 'pending' | 'running' | 'completed' | 'failed';
  overall_health_score: number; // 0-100
  category_scores: CategoryScores;
  findings_count: FindingsCount;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  metadata?: Record<string, any>;
}

export interface CategoryScores {
  security: number;
  code_quality: number;
  performance: number;
  maintainability: number;
  devops: number;
  frontend: number;
}

export interface FindingsCount {
  total: number;
  critical: number;
  major: number;
  minor: number;
  info: number;
}

export interface Finding {
  id: string;
  review_id: string;
  module: 'security' | 'code_quality' | 'performance' | 'maintainability' | 'devops' | 'frontend';
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: string;
  title: string;
  description: string;
  file: string;
  line?: number;
  column?: number;
  code_snippet?: string;
  tool: string;
  confidence: number; // 0.0-1.0
  evidence: string[];
  suggested_fix?: SuggestedFix;
  references: string[];
  ai_explanation?: string;
  priority_score: number; // 0-100
  created_at: string;
  feedback?: Feedback[];
}

export interface SuggestedFix {
  code: string;
  explanation: string;
  safety_score: number; // 0.0-1.0
  automated: boolean;
  diff?: string; // Unified diff format
}

export interface Scorecard {
  overall: number; // 0-100
  categories: CategoryScores;
  trends: {
    last_7_days: number[];
    last_30_days: number[];
    last_90_days: number[];
  };
  last_review?: {
    review_id: string;
    completed_at: string;
  };
}

// ============================================================================
// DevTools Types
// ============================================================================

export interface DevToolsEvent {
  id: string;
  run_id: string;
  type: 'network' | 'log' | 'performance' | 'memory' | 'storage' | 'lighthouse';
  timestamp: number; // milliseconds since epoch
  data: NetworkEvent | LogEvent | PerformanceEvent | MemoryEvent | StorageEvent | LighthouseEvent;
}

export interface NetworkEvent {
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  headers: Record<string, string>;
  requestBody?: string; // redacted if contains secrets
  responseBody?: string; // redacted if contains secrets
  duration: number; // milliseconds
  size: number; // bytes
  startTime: number;
  endTime: number;
  type: 'xhr' | 'fetch' | 'script' | 'stylesheet' | 'image' | 'font' | 'other';
}

export interface LogEvent {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  args?: any[];
  stack?: string;
  source: string; // file:line
}

export interface PerformanceEvent {
  type: 'longtask' | 'measure' | 'mark' | 'navigation';
  name: string;
  duration: number;
  startTime: number;
  entryType: string;
  detail?: any;
}

export interface MemoryEvent {
  heapSize: number;
  usedHeapSize: number;
  heapSizeLimit: number;
  timestamp: number;
}

export interface StorageEvent {
  type: 'localStorage' | 'sessionStorage' | 'indexedDB';
  action: 'set' | 'get' | 'remove' | 'clear';
  key?: string;
  value?: string;
  size: number;
}

export interface LighthouseEvent {
  performance: number; // 0-100
  accessibility: number;
  bestPractices: number;
  seo: number;
  metrics: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    totalBlockingTime: number;
    cumulativeLayoutShift: number;
    speedIndex: number;
  };
  opportunities: LighthouseOpportunity[];
}

export interface LighthouseOpportunity {
  id: string;
  title: string;
  description: string;
  savings: number; // milliseconds or bytes
  severity: 'low' | 'medium' | 'high';
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'network' | 'performance' | 'memory' | 'log';
  events: TimelineEvent[];
  color: string;
}

export interface TimelineEvent {
  id: string;
  startTime: number;
  duration: number;
  label: string;
  data?: any;
}

export interface WaterfallEntry {
  id: string;
  name: string;
  url: string;
  method: string;
  startTime: number;
  duration: number;
  phases: {
    dns: number;
    connect: number;
    ssl: number;
    send: number;
    wait: number;
    receive: number;
  };
  status: number;
  size: number;
  type: string;
}

// ============================================================================
// Feedback Types
// ============================================================================

export interface Feedback {
  id: string;
  issue_id: string;
  review_id: string;
  user_id?: string;
  action: 'accept' | 'dismiss' | 'resolve' | 'ignore';
  comment?: string;
  created_at: string;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface FindingFilters {
  category?: string;
  severity?: 'critical' | 'major' | 'minor' | 'info';
  search?: string;
  file?: string;
  tool?: string;
  confidence_min?: number;
  only_changed_files?: boolean; // for PR view
}

export interface TimelineFilters {
  startTime?: number;
  endTime?: number;
  types?: string[];
  search?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface RunSummary {
  run: AnalysisRun;
  scorecard: Scorecard;
  top_risks: Finding[];
  quick_wins: Finding[];
}

// ============================================================================
// Diff Types
// ============================================================================

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'normal' | 'add' | 'delete' | 'context';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  issues?: Finding[]; // Issues on this line
}

// ============================================================================
// State Management Types
// ============================================================================

export interface AppState {
  repos: Repo[];
  currentRepo?: Repo;
  runs: Record<string, AnalysisRun[]>; // repo_id -> runs
  currentRun?: AnalysisRun;
  findings: Record<string, Finding[]>; // run_id -> findings
  filters: FindingFilters;
  selectedFinding?: Finding;
  devToolsEvents: DevToolsEvent[];
  websocketConnected: boolean;
  safeMode: boolean; // redact sensitive data
}

// ============================================================================
// UI State Types
// ============================================================================

export type TabType = 
  | 'security' 
  | 'code_quality' 
  | 'performance' 
  | 'maintainability' 
  | 'devops' 
  | 'frontend'
  | 'inspector'
  | 'network'
  | 'performance_tools'
  | 'memory'
  | 'storage'
  | 'lighthouse'
  | 'sources'
  | 'timeline';

export interface UIState {
  activeTab: TabType;
  sidebarOpen: boolean;
  drawerOpen: boolean;
  drawerContent?: 'finding' | 'code' | 'diff' | 'network';
  selectedFindingId?: string;
  selectedFile?: string;
  timelineZoom: number;
  timelineOffset: number;
}

