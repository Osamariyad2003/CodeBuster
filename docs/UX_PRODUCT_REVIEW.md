# CodeBuster UX & Product Design Review

Senior Product Designer + UX Architect evaluation of the CodeBuster SaaS UI flow (AI-powered GitHub code review platform).

---

## 1️⃣ Flow Completeness

**Intended journey:** First visit → GitHub OAuth → Repo connection → First scan → PR review → Ongoing usage.

| Stage | Status | Gaps |
|-------|--------|------|
| **First visit** | ✅ Home exists with “Login with GitHub” | “Skip to Dashboard (Demo)” is confusing in production; no clear value prop for first-time visitors. |
| **GitHub OAuth** | ✅ AuthContext + redirect to GitHub | No in-app handling of `auth_error` / permission_denied from callback URL; user can land back with no explanation. |
| **Post-OAuth** | ⚠️ Partial | After OAuth, user goes to dashboard. **Missing:** Dedicated “Connect your first repo” step before dashboard; dashboard may call `/github/repos` (500 in logs) and show error. |
| **Repo connection** | ✅ RepositoriesPage + “Connect Repository” → install-url → GitHub App install | **Missing:** If install is cancelled or user returns without `installation_id`, no in-app “Connection cancelled” state. ConnectCallback shows error but **ConnectCallback uses `<Header />` without importing it** → runtime error. |
| **First scan** | ✅ Repo dashboard has “Scan Now” + Scan result card | Flow works. No explicit “First scan” onboarding (e.g. “Run your first scan to see results here”). |
| **PR review** | ⚠️ Split | Reviews come from **manual scan** or **webhook**. There is no dedicated “PR review” screen that maps 1:1 to a GitHub PR (branch, diff, PR comments). ReviewDetail is generic (review id, counts, summary); **no link to the actual GitHub PR** or “View on GitHub”. |
| **Ongoing usage** | ✅ Repos list, repo dashboard, reviews list, jobs/events | **Missing:** No notifications/inbox for “new review ready” or “webhook failed”. No “Recent activity” that spans repos. |

**Broken or missing transitions:**
- **Dashboard ↔ Repos:** Dashboard uses `/github/repos` (500 when GitHub API times out); repos list uses `/api/repos`. Two different backends for “my repos” → inconsistent data and failure mode.
- **Review → GitHub:** No “Open PR on GitHub” or “View PR” from a review tied to a PR.
- **Scan complete → Where to go:** Toast says “Results will appear here”; if user is on another tab, they may not know where “here” is (no global “Review ready” entry point).

---

## 2️⃣ Real-World Readiness (Anti–Toy App Check)

| Screen | Survive real usage? | Scale risks | Demo-like aspects |
|--------|---------------------|------------|-------------------|
| **RepositoriesPage** | ⚠️ | Many repos: single list, no search/filter, no pagination. Cards show “View Reviews” but no “last scan” timestamp on card in some flows. | “Your Repositories” is generic; no repo search. |
| **RepositoryDashboard** | ⚠️ | Many reviews: “Latest review” only; IssueTable paginated but filters not in URL (cannot share “critical security” view). Trend chart and radar assume one latest review. | Scan result card is good; rest of page is dense (stats + radar + fix-first + issues + trend + tabs). |
| **ReviewsView / ReviewsHistoryPage** | ⚠️ | Many reviews: table only, no virtualisation; no “Filter by branch/PR”. | Table shows PR # or “Manual”; no link to GitHub PR. |
| **ReviewDetail** | ❌ | **Bug:** `setReview(response.data)` but apiClient returns `response.data` in interceptor → `response` is already the body, so `response.data` is undefined and review is blank. | Summary shows “No summary available” placeholder; no issues list on this page; no “View on GitHub”. |
| **IssueTable + IssueDetailDrawer** | ✅ | Pagination and filters exist. | Confidence shown as %; evidence as list. No “Dismiss” or “Create ticket” in drawer. |
| **EventsPage / JobsPage** | ✅ | Pagination, filters, cache. | Empty state: “Trigger a webhook event” / “Push code or open a PR” — OK. No “Retry failed job” button. |
| **Dashboard (legacy)** | ⚠️ | Uses mock data flag and `/github/repos`; duplicates “repos” concept. | ProjectDropzone + RunHistory + ReviewResult feel like a separate “upload and run” product, not GitHub-native. |

**What would break at scale:**
- Repo list with 100+ repos: no search, no “favorites”, no pagination.
- Review list with 100+ reviews: table loads all (or large page); no “by repo” or “by date range”.
- Many issues in one review: IssueTable is paginated (good); drawer has no “Previous/Next issue” for quick triage.

---

## 3️⃣ Edge Cases & Failure States

| Scenario | Handled? | Notes |
|----------|----------|--------|
| **GitHub permission errors** | ⚠️ | Auth callback can receive `auth_error`; AuthContext logs it. No dedicated “Permission denied” screen or “Re-authorize” CTA. |
| **Webhook failures** | ⚠️ | Events list shows events; no explicit “Failed” filter or “Webhook delivery failed” banner. Jobs show status; no “Retry” on failed job. |
| **Partial scan failures** | ❌ | If some analyzers fail, backend may still return 200 with partial results. UI does not show “3 of 5 analyzers completed” or “CodeQL failed”. |
| **Empty: no repos** | ✅ | RepositoriesPage empty state + “Connect GitHub Repository”. |
| **Empty: no PRs/reviews** | ✅ | ReviewsView: “No reviews yet” + “Run a scan…” / “Open a PR”. |
| **Empty: no findings** | ✅ | IssueTable: “No issues match the filters.” No “No issues in this review” celebratory state. |
| **Rate limits (429)** | ✅ | apiClient dispatches `api-error`; ToastProvider shows toast. No “Retry after Xs” button or backoff message in UI. |
| **API timeout / 500** | ⚠️ | Repos fetch: error state + toast. **GET /github/repos 500** (e.g. GitHub API timeout) leaves Dashboard with error; no “Retry” or fallback to `/api/repos`. |
| **ConnectCallback missing installation_id** | ✅ | Error message + “Back to Repositories”. |
| **Review not found (404)** | ✅ | ReviewDetail: “Review not found” + Back. |
| **Loading forever** | ⚠️ | No global timeout or “Request taking long; retry?” for fetches. |

**Missing or weak:**
- No “Partial failure” or “Some analyzers failed” state on review/scan result.
- No “Reconnect repo” or “Refresh GitHub permissions” from repo settings when token/install is invalid.
- ConnectCallback: **Header is used but not imported** → JS error on that page.

---

## 4️⃣ Cognitive Load & UX Clarity

| Question | Answer |
|----------|--------|
| **Where am I?** | ✅ AppShell/sidebar + repo breadcrumb (Repositories → Repo name). Review detail and Issues could show “Repo X → Review Y” more prominently. |
| **What just happened?** | ⚠️ Scan: toast “Scan started” then “Scan complete. Review result is ready.” Good. No confirmation after “Connect Repository” beyond callback success. No “Review completed” for webhook-triggered reviews. |
| **What do I do next?** | ⚠️ After first connect: redirect to repos. After first scan: result card + “View full report”. **Unclear:** What to do with issues (fix? ignore? ticket?) beyond opening the drawer. Fix-first checklist has no “Mark done” or “Open in IDE”. |

**Overwhelming or ambiguous:**
- **RepositoryDashboard:** Many blocks (Scan result, Stats cards, Radar, Fix first, Issues table, Trend, Tabs). New users may not know order of attention (score first vs issues first).
- **ReviewDetail:** Shows counts and summary but **no list of issues**; user must go back to repo dashboard or guess URL. So “what do I do next?” is broken.
- **Two “Reviews” entry points:** Sidebar “Reviews” (ReviewsPage) vs repo “AI Reviews” tab (ReviewsView). Different lists (global vs per-repo); not explained.

**Suggestions:**
- Single “Reviews” that is repo-scoped by default with a “All repos” filter, or clear labels: “Reviews (this repo)” vs “All reviews”.
- Review detail page must list issues (or link “View N issues” to repo dashboard with that review selected).
- Add a one-line “What CodeBuster does” on Home and a “First time? Connect a repo, then run Scan” on empty repo list.

---

## 5️⃣ Trust, Transparency & Confidence

| Aspect | Status |
|--------|--------|
| **Why was this flagged?** | ✅ IssueDetailDrawer shows evidence (list) + description + recommendation. Good. No “Rule ID” or “Analyzer” per finding in drawer (e.g. “security_analyzer” / “CodeQL”). |
| **Confidence scores** | ✅ IssueTable shows confidence %; drawer shows severity. No explanation of “What does confidence mean?” (e.g. tooltip: “How sure the analyzer is”). |
| **Severity** | ✅ Badges (Critical/Major/etc.). No link to severity definition or policy. |
| **Evidence** | ✅ Evidence as bullet list. No “View in file” or line number link to GitHub. |
| **Building trust** | ⚠️ No “Why we show this” or “How CodeBuster works” (analyzers → AI → issues). No “Report false positive” or feedback per issue in the main repo dashboard flow (ReviewResult has feedback; repo dashboard drawer does not). |

**Where trust fails:**
- Review shows “Grade B” or “78/100” with no breakdown of how the score is computed (category weights, formula).
- No indication of “AI-generated” vs “Rule-based” for each finding.
- Fix-first list has no source (e.g. “From top risks + quick wins”).

---

## 6️⃣ GitHub-Native Alignment

| Aspect | Status |
|--------|--------|
| **PR-centric flow** | ⚠️ Reviews can be manual or webhook; webhook is PR/push. UI is “review-centric”, not “PR-centric”: you see a review, not “PR #42 → Review”. |
| **PR comments** | ⚠️ Backend can post to GitHub; UI has “Apply fix” in ReviewResult. No “View PR on GitHub” or “See CodeBuster comment on GitHub” link. |
| **Repo concepts** | ✅ Repos, branches, commits appear. Repo dashboard is clear. |
| **Mappings** | ⚠️ Review has `pr_number` but ReviewDetail doesn’t show “PR #X” link. ReviewsView shows “#Manual” or “#N/A” for PR number; no link when it’s a PR. |

**Disconnected from GitHub mental models:**
- Developers think “I opened a PR → where’s the review?”. CodeBuster shows “Reviews” as a list; the link from “this PR” to “this review” is not obvious (no PR number link, no “From PR” in review card).
- “Scan Now” is manual; GitHub users might expect “every PR gets a review” (webhook). No explanation that “Connect webhook for automatic PR reviews”.

---

## 7️⃣ Actionability

| Report / Screen | Can user act? | Next steps obvious? | Stops at “information” not “decision”? |
|-----------------|---------------|----------------------|----------------------------------------|
| **Scan result card** | ✅ “View full report” | Yes. | No “Run scan again” or “Share report” on the card. |
| **IssueTable** | ✅ Row click → drawer | Yes. | Drawer: Close only. No “Dismiss”, “Create Jira”, “Copy link”, “Open in GitHub”. |
| **IssueDetailDrawer** | ⚠️ | Recommendation shown. | No “Apply fix” (exists in ReviewResult, not here), “Ignore”, or “Mark as accepted risk”. |
| **FixFirstChecklist** | ⚠️ | List only. | No “Mark done”, “Open issue”, or link to issue detail. |
| **ReviewDetail** | ❌ | Back to list. | No issues list; no “View issues” CTA; no “Open PR on GitHub” or “Apply fixes”. |
| **ReviewsView row** | ✅ Click → ReviewDetail | Yes. | ReviewDetail doesn’t drive next action (fix / ignore). |
| **Events/Jobs** | ⚠️ | View details. | No “Retry job” or “Re-deliver webhook”. |

**Summary:** The repo dashboard and issue table give information; the **decision** (fix, ignore, ticket, re-run) is underdeveloped except in the legacy ReviewResult (feedback + apply fix). Issue drawer and Fix-first need explicit actions.

---

## Recommended Priorities

### P0 – Fixes
1. **ReviewDetail:** Fix `setReview(response)` (apiClient returns body). Add issues list or “View N issues” linking to repo dashboard with that review.
2. **ConnectCallback:** Import and render `Header` (or remove it and use AppShell so callback is inside shell).
3. **Dashboard/repos:** Resolve GET /github/repos 500 (timeout); use `/api/repos` consistently or show retry/fallback.

### P1 – Flow & clarity
4. **PR ↔ Review link:** On every review that has `pr_number`, show “PR #X” linking to GitHub.
5. **Single “Reviews” model:** Clarify “This repo’s reviews” vs “All reviews” and make one primary path.
6. **After scan:** One clear CTA: “View issues” or “View full report” with issues on the same page.

### P2 – Trust & action
7. **Issue drawer actions:** Add “Dismiss”, “Open in GitHub (file:line)”, and optionally “Apply fix” where supported.
8. **Score transparency:** Short “How we score” (categories, weights) or link to docs.
9. **Partial failure:** If backend returns analyzer status, show “X of Y analyzers completed” or “CodeQL failed”.

### P3 – Scale & production
10. **Repos:** Search, pagination, or “favorites”.
11. **Rate limit:** Toast + optional “Retry in Xs” button.
12. **Webhook/permissions:** “Webhook delivery failed” banner and “Re-authorize” or “Check permissions” CTA.

---

*Evaluation based on codebase review (App.jsx, routes, RepositoriesPage, RepositoryDashboard, ReviewDetail, IssueTable, IssueDetailDrawer, ConnectCallback, apiClient, ToastProvider, and related components).*
