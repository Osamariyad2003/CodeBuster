# CodeBuster Frontend - Complete Design Document

## A) High-Level UX Description

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: CodeBuster | [Repo Selector] | [User Menu]            │
├──────────┬──────────────────────────────────────────┬───────────┤
│          │  Tabs: Security | Quality | Perf |      │           │
│          │  DevOps | DevTools (Inspector|Network|   │  Details  │
│ Sidebar  │  Perf|Memory|Storage|Lighthouse|Sources)│  Drawer   │
│          │                                          │           │
│ - Repos  │  ┌────────────────────────────────────┐  │           │
│ - Runs   │  │  Main Content Area                │  │           │
│ - PRs    │  │  - Scorecards                     │  │           │
│          │  │  - Findings Table / Timeline      │  │           │
│          │  │  - Code Viewer / Diff             │  │           │
│          │  └────────────────────────────────────┘  │           │
└──────────┴──────────────────────────────────────────┴───────────┘
```

### Design Principles

1. **DevTools-Inspired**: Dark theme, compact layout, tabbed interface
2. **Information Density**: Show maximum useful information without clutter
3. **Progressive Disclosure**: Details in drawer, expandable sections
4. **Real-time Updates**: WebSocket for live events, polling for static data
5. **Performance First**: Virtualized lists, lazy loading, code splitting

### User Flows

**Flow 1: Viewing Repository Health**
1. Select repo from sidebar
2. See overall health scorecard
3. Click category tab (Security/Quality/etc.)
4. Browse findings table
5. Click finding → details drawer opens
6. View code with inline highlighting
7. Apply filter (severity, file, search)

**Flow 2: Analyzing PR**
1. Navigate to PR view
2. See diff view with inline issues
3. Filter "only changed files"
4. Click issue → see suggested patch
5. Accept/dismiss/resolve with comment

**Flow 3: Runtime DevTools Mode**
1. Connect to running app (via SDK)
2. Open DevTools tab (Network/Performance/etc.)
3. See live events streaming
4. Interact with timeline (zoom, pan)
5. Inspect network requests, memory snapshots
6. Export report

---

## B) Detailed Page/Component Breakdown

### Pages

#### `/dashboard`
- Overview of all connected repositories
- Recent runs across repos
- Quick stats (total issues, health trends)
- Quick actions (new analysis, connect repo)

#### `/repo/[id]`
- Repository overview
- Health scorecard (overall + per category)
- Recent runs list
- Quick filters (last 7/30/90 days)
- Action buttons (trigger analysis, settings)

#### `/repo/[id]/runs/[runId]`
- Run details page
- Tabs: Summary | Findings | DevTools
- Summary: Scorecard, stats, metadata
- Findings: Table with filters
- DevTools: All panels (Network, Performance, etc.)

#### `/repo/[id]/pulls/[prId]`
- PR-specific view
- Diff view with inline issues
- "Only changed files" filter active
- PR metadata (author, commits, status)
- Review actions (approve, request changes)

#### `/settings`
- Repository settings
- API keys management
- Notification preferences
- SDK integration guide

### Component Tree

```
App
├── AppShell
│   ├── Header
│   │   ├── Logo
│   │   ├── RepoSelector
│   │   └── UserMenu
│   ├── Sidebar
│   │   ├── RepoList
│   │   ├── RunList
│   │   └── PRList
│   ├── MainContent
│   │   ├── TabBar
│   │   │   ├── CategoryTabs (Security/Quality/Perf/DevOps)
│   │   │   └── DevToolsTabs (Inspector/Network/etc.)
│   │   └── ContentArea
│   │       ├── Dashboard (on /dashboard)
│   │       ├── RepoView (on /repo/[id])
│   │       ├── RunView (on /repo/[id]/runs/[runId])
│   │       └── PRView (on /repo/[id]/pulls/[prId])
│   └── DetailsDrawer
│       ├── FindingDetails
│       ├── CodeViewer
│       └── DiffViewer
├── ScoreCards
│   ├── OverallScoreCard
│   └── CategoryScoreCard[]
├── FindingsTable
│   ├── TableHeader (sortable)
│   ├── VirtualizedRow[]
│   └── TableFooter (pagination)
├── CodeViewer
│   ├── FileTree
│   ├── CodeEditor (Monaco)
│   └── LineHighlights
├── DiffViewer
│   ├── DiffHeader
│   ├── DiffHunks[]
│   └── SuggestedPatch
├── TimelineViewer
│   ├── TimelineCanvas
│   ├── ZoomControls
│   └── EventMarkers[]
├── NetworkPanel
│   ├── WaterfallView
│   ├── RequestList
│   └── RequestDetails
├── PerformancePanel
│   ├── LongTasksList
│   ├── PerformanceMarks
│   └── FlameGraph
├── MemoryPanel
│   ├── MemoryChart
│   ├── SnapshotList
│   └── LeakDetector
├── StoragePanel
│   ├── StorageTree
│   ├── KeyValueView
│   └── DiffView
├── LighthousePanel
│   ├── ScoreCards
│   ├── Opportunities
│   └── Metrics
├── SourcesPanel
│   ├── FileTree
│   ├── SourceViewer
│   └── SearchBox
└── FeedbackControls
    ├── AcceptButton
    ├── DismissButton
    ├── ResolveButton
    └── CommentInput
```

---

## C) TypeScript Interfaces

```typescript
// Core Types
interface Repo {
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

interface AnalysisRun {
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

interface CategoryScores {
  security: number;
  code_quality: number;
  performance: number;
  maintainability: number;
  devops: number;
  frontend: number;
}

interface FindingsCount {
  total: number;
  critical: number;
  major: number;
  minor: number;
  info: number;
}

interface Finding {
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

interface SuggestedFix {
  code: string;
  explanation: string;
  safety_score: number; // 0.0-1.0
  automated: boolean;
  diff?: string; // Unified diff format
}

interface Scorecard {
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

// DevTools Types
interface DevToolsEvent {
  id: string;
  run_id: string;
  type: 'network' | 'log' | 'performance' | 'memory' | 'storage' | 'lighthouse';
  timestamp: number; // milliseconds since epoch
  data: NetworkEvent | LogEvent | PerformanceEvent | MemoryEvent | StorageEvent | LighthouseEvent;
}

interface NetworkEvent {
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

interface LogEvent {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  args?: any[];
  stack?: string;
  source: string; // file:line
}

interface PerformanceEvent {
  type: 'longtask' | 'measure' | 'mark' | 'navigation';
  name: string;
  duration: number;
  startTime: number;
  entryType: string;
  detail?: any;
}

interface MemoryEvent {
  heapSize: number;
  usedHeapSize: number;
  heapSizeLimit: number;
  timestamp: number;
}

interface StorageEvent {
  type: 'localStorage' | 'sessionStorage' | 'indexedDB';
  action: 'set' | 'get' | 'remove' | 'clear';
  key?: string;
  value?: string;
  size: number;
}

interface LighthouseEvent {
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

interface LighthouseOpportunity {
  id: string;
  title: string;
  description: string;
  savings: number; // milliseconds or bytes
  severity: 'low' | 'medium' | 'high';
}

interface TimelineTrack {
  id: string;
  name: string;
  type: 'network' | 'performance' | 'memory' | 'log';
  events: TimelineEvent[];
  color: string;
}

interface TimelineEvent {
  id: string;
  startTime: number;
  duration: number;
  label: string;
  data?: any;
}

interface WaterfallEntry {
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

// Feedback Types
interface Feedback {
  id: string;
  issue_id: string;
  review_id: string;
  user_id?: string;
  action: 'accept' | 'dismiss' | 'resolve' | 'ignore';
  comment?: string;
  created_at: string;
}

// Filter Types
interface FindingFilters {
  category?: string;
  severity?: 'critical' | 'major' | 'minor' | 'info';
  search?: string;
  file?: string;
  tool?: string;
  confidence_min?: number;
  only_changed_files?: boolean; // for PR view
}

interface TimelineFilters {
  startTime?: number;
  endTime?: number;
  types?: string[];
  search?: string;
}

// API Response Types
interface ApiResponse<T> {
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

interface RunSummary {
  run: AnalysisRun;
  scorecard: Scorecard;
  top_risks: Finding[];
  quick_wins: Finding[];
}

// State Management Types
interface AppState {
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
```

---

## D) API Contract List

### REST Endpoints

#### Repositories
```
GET    /api/repos
GET    /api/repos/:id
GET    /api/repos/:id/scorecard
POST   /api/repos/:id/analyze
```

#### Runs
```
GET    /api/repos/:id/runs
GET    /api/runs/:id
GET    /api/runs/:id/summary
GET    /api/runs/:id/findings
  Query params: category, severity, search, file, tool, confidence_min, page, per_page
GET    /api/runs/:id/files/:path
  Returns: { content: string, language: string, lines: number }
```

#### Findings
```
GET    /api/findings/:id
GET    /api/findings/:id/suggested-fix
POST   /api/findings/:id/feedback
  Body: { action: 'accept'|'dismiss'|'resolve'|'ignore', comment?: string }
```

#### Pull Requests
```
GET    /api/repos/:id/pulls
GET    /api/repos/:id/pulls/:prNumber
GET    /api/repos/:id/pulls/:prNumber/runs
GET    /api/repos/:id/pulls/:prNumber/diff
  Returns: { hunks: DiffHunk[], issues: Finding[] }
```

#### DevTools Events
```
GET    /api/runs/:id/events
  Query params: type, startTime, endTime, search, page, per_page
GET    /api/runs/:id/events/network
GET    /api/runs/:id/events/performance
GET    /api/runs/:id/events/memory
GET    /api/runs/:id/events/storage
GET    /api/runs/:id/events/lighthouse
```

### WebSocket Channels

#### Runtime Mode
```
WS     /ws/runs/:id/live
  Messages:
    - Client -> Server: { type: 'subscribe', filters?: TimelineFilters }
    - Server -> Client: { type: 'event', event: DevToolsEvent }
    - Server -> Client: { type: 'snapshot', data: any }
    - Server -> Client: { type: 'error', message: string }
```

### Response Formats

```typescript
// GET /api/repos/:id/runs
{
  success: true,
  data: AnalysisRun[],
  pagination: {
    page: 1,
    per_page: 20,
    total: 45,
    total_pages: 3
  }
}

// GET /api/runs/:id/findings
{
  success: true,
  data: Finding[],
  filters: FindingFilters,
  pagination: { ... }
}

// GET /api/runs/:id/summary
{
  success: true,
  data: RunSummary
}

// WebSocket message
{
  type: 'event',
  timestamp: 1234567890,
  event: DevToolsEvent
}
```

---

## E) MVP Roadmap with Milestones

### Week 1: UI Skeleton + Dashboard + Scorecards

**Day 1-2: Project Setup**
- [ ] Initialize Next.js 14 with TypeScript + Tailwind
- [ ] Set up project structure (pages, components, lib, hooks)
- [ ] Configure API client (axios/fetch wrapper)
- [ ] Set up React Query for data fetching
- [ ] Create base layout components (Header, Sidebar)

**Day 3-4: Dashboard Page**
- [ ] Create `/dashboard` page
- [ ] Implement repo list with search
- [ ] Add recent runs widget
- [ ] Create quick stats cards
- [ ] Add navigation to repo views

**Day 5: Scorecards Component**
- [ ] Create `ScoreCards` component
- [ ] Implement `OverallScoreCard` with trend chart
- [ ] Implement `CategoryScoreCard` components
- [ ] Add color coding (red/yellow/green)
- [ ] Add tooltips with explanations

**Deliverable**: Working dashboard with scorecards

---

### Week 2: Findings Table + Code Viewer + Filters

**Day 1-2: Findings Table**
- [ ] Create `FindingsTable` component
- [ ] Implement virtualized list (react-window)
- [ ] Add sortable columns (severity, file, line, confidence)
- [ ] Add row selection
- [ ] Implement pagination

**Day 3: Filters**
- [ ] Create `FindingFilters` component
- [ ] Implement category filter (dropdown)
- [ ] Implement severity filter (checkboxes)
- [ ] Implement search (debounced)
- [ ] Add "only changed files" toggle for PR view
- [ ] Persist filters in URL query params

**Day 4-5: Code Viewer**
- [ ] Integrate Monaco Editor
- [ ] Create `CodeViewer` component
- [ ] Implement line highlighting
- [ ] Add file tree navigation
- [ ] Add syntax highlighting
- [ ] Implement "Go to line" functionality

**Deliverable**: Full findings table with filters and code viewer

---

### Week 3: DevTools Panels (Network + Logs + Timeline)

**Day 1-2: Network Panel**
- [ ] Create `NetworkPanel` component
- [ ] Implement waterfall view (custom canvas)
- [ ] Add request list with filters
- [ ] Implement request details drawer
- [ ] Add request/response body viewer (with redaction)
- [ ] Add timing breakdown visualization

**Day 3: Logs Panel**
- [ ] Create `LogsPanel` component
- [ ] Implement log level filtering
- [ ] Add search functionality
- [ ] Implement log grouping
- [ ] Add stack trace viewer

**Day 4-5: Timeline Panel**
- [ ] Create `TimelineViewer` component
- [ ] Implement timeline canvas with zoom/pan
- [ ] Add event markers
- [ ] Implement track grouping
- [ ] Add time range selection
- [ ] Implement event details on click

**Deliverable**: Working Network, Logs, and Timeline panels

---

### Week 4: Runtime WebSocket Mode + SDK Handshake

**Day 1-2: WebSocket Integration**
- [ ] Set up WebSocket client (useSocket hook)
- [ ] Implement connection management
- [ ] Add reconnection logic
- [ ] Implement event buffering
- [ ] Add connection status indicator

**Day 3: SDK Integration**
- [ ] Create SDK documentation page
- [ ] Implement SDK handshake endpoint
- [ ] Add runtime mode toggle
- [ ] Implement event streaming
- [ ] Add rate limiting UI

**Day 4-5: Live Updates**
- [ ] Update Network panel for live events
- [ ] Update Performance panel for live events
- [ ] Update Memory panel for live snapshots
- [ ] Add "pause/resume" controls
- [ ] Implement event export

**Deliverable**: Working runtime mode with WebSocket streaming

---

### Week 5+: Polish + Feedback Actions + Export

**Day 1-2: Feedback System**
- [ ] Create `FeedbackControls` component
- [ ] Implement accept/dismiss/resolve actions
- [ ] Add comment input
- [ ] Implement feedback API calls
- [ ] Add feedback status indicators

**Day 3: Diff Viewer**
- [ ] Integrate react-diff-view
- [ ] Create `DiffViewer` component
- [ ] Implement inline issue highlighting
- [ ] Add "suggested patch" display
- [ ] Add apply patch button (disabled for safety)

**Day 4: Export & Reports**
- [ ] Implement PDF export
- [ ] Add CSV export for findings
- [ ] Create report template
- [ ] Add email report option

**Day 5: Performance Optimization**
- [ ] Implement code splitting
- [ ] Add lazy loading for heavy components
- [ ] Optimize virtualized lists
- [ ] Add loading states
- [ ] Implement error boundaries

**Day 6-7: Testing & Bug Fixes**
- [ ] Write component tests
- [ ] Test API integration
- [ ] Test WebSocket connection
- [ ] Fix bugs and edge cases
- [ ] Performance testing

**Deliverable**: Production-ready frontend

---

## Additional Implementation Details

### State Management Recommendation

**Use React Query (TanStack Query) + Zustand**

- **React Query**: For server state (runs, findings, events)
  - Automatic caching
  - Background refetching
  - Optimistic updates
  - Pagination support

- **Zustand**: For client state (UI state, filters, selected items)
  - Lightweight
  - Simple API
  - No boilerplate

**Example Setup**:
```typescript
// hooks/useFindings.ts
export function useFindings(runId: string, filters: FindingFilters) {
  return useQuery({
    queryKey: ['findings', runId, filters],
    queryFn: () => api.getFindings(runId, filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// store/uiStore.ts
export const useUIStore = create((set) => ({
  selectedFinding: null,
  setSelectedFinding: (finding) => set({ selectedFinding: finding }),
  filters: {},
  setFilters: (filters) => set({ filters }),
}));
```

### Visualization Libraries

1. **Recharts** - For scorecards and trends
   - Simple API
   - Responsive
   - Good TypeScript support

2. **Monaco Editor** - For code viewing
   - Same editor as VS Code
   - Excellent syntax highlighting
   - Good performance

3. **react-diff-view** - For diff viewing
   - Clean API
   - Good customization
   - Handles large diffs well

4. **react-window** - For virtualized lists
   - Lightweight
   - Good performance
   - Easy to use

5. **Custom Canvas** - For timeline/waterfall
   - Full control
   - Better performance for complex visuals
   - Can optimize for specific use case

### Security & Privacy

1. **Data Redaction**
   - Scan request/response bodies for secrets
   - Redact API keys, tokens, passwords
   - Show "[REDACTED]" placeholder

2. **Safe Mode Toggle**
   - Hide request/response bodies
   - Hide sensitive headers
   - Hide stack traces

3. **Runtime Mode Security**
   - Require authentication
   - Rate limit connections
   - Validate SDK tokens
   - Sandbox iframe for external apps

### Performance Optimizations

1. **Virtualization**: Use react-window for large lists
2. **Code Splitting**: Lazy load DevTools panels
3. **Memoization**: Memoize expensive computations
4. **Debouncing**: Debounce search/filter inputs
5. **Pagination**: Load findings in pages
6. **WebSocket Throttling**: Throttle high-frequency events

---

## File Structure

```
frontend/
├── app/                    # Next.js 14 app directory
│   ├── dashboard/
│   ├── repo/
│   │   └── [id]/
│   │       ├── runs/
│   │       └── pulls/
│   └── settings/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── DetailsDrawer.tsx
│   ├── dashboard/
│   │   ├── ScoreCards.tsx
│   │   └── RecentRuns.tsx
│   ├── findings/
│   │   ├── FindingsTable.tsx
│   │   ├── FindingFilters.tsx
│   │   └── FindingDetails.tsx
│   ├── code/
│   │   ├── CodeViewer.tsx
│   │   └── DiffViewer.tsx
│   └── devtools/
│       ├── NetworkPanel.tsx
│       ├── PerformancePanel.tsx
│       ├── MemoryPanel.tsx
│       ├── StoragePanel.tsx
│       ├── LighthousePanel.tsx
│       ├── TimelineViewer.tsx
│       └── SourcesPanel.tsx
├── lib/
│   ├── api.ts              # API client
│   ├── websocket.ts        # WebSocket client
│   └── redaction.ts        # Data redaction utilities
├── hooks/
│   ├── useFindings.ts
│   ├── useRuns.ts
│   ├── useWebSocket.ts
│   └── useFilters.ts
├── store/
│   └── uiStore.ts          # Zustand store
├── types/
│   └── index.ts            # TypeScript interfaces
└── styles/
    └── globals.css         # Tailwind + custom styles
```

---

This design provides a complete, implementation-ready frontend architecture that matches the backend API and provides a professional DevTools-like experience.

