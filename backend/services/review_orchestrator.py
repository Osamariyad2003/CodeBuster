"""Review orchestrator - coordinates all analyzers and AI reasoning."""
from typing import List, Dict, Any, Optional
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from .security_analyzer import SecurityAnalyzer

# Default: run all tools (security + code quality + performance + devops + etc.)
DEFAULT_ANALYZERS = {
    "codeql": True,
    "sonarqube": True,
    "security": True,
    "dependencies": True,
    "dead_code": True,
    "duplicate_code": True,
    "trufflehog": True,
    "semgrep": True,
    "lint": True,
    "performance": True,
    "iac": True,
    "accessibility": True,
    "maintainability": True,
    "frontend": True,
    "dimension": True,
    "codereviewer": True,
    "legacy_quality": True,
}
from .semgrep_analyzer import SemgrepAnalyzer
from .lint_analyzer import LintAnalyzer
from .code_quality_analyzer import CodeQualityAnalyzer
from .iac_analyzer import IaCAnalyzer
from .accessibility_analyzer import AccessibilityAnalyzer
from .codeql_analyzer import CodeQLAnalyzer
from .sonarqube_analyzer import SonarQubeAnalyzer
from .trufflehog_scanner import TruffleHogScanner
from .dimension_performance_analyzer import PerformanceDimensionAnalyzer
from .frontend_devtools_analyzer import FrontendDevToolsAnalyzer
from .lighthouse_service import LighthouseService
from .coverage_analyzer import CoverageAnalyzer
from .dependency_analyzer import DependencyAnalyzer
from .dead_code_analyzer import DeadCodeAnalyzer
from .duplicate_code_analyzer import DuplicateCodeAnalyzer
from .ai_review_service import AIReviewService
from .awesome_linters_mapper import AwesomeLintersMapper
from .claude_enrichment_service import ClaudeEnrichmentService
from .codereviewer_analyzer import analyze as codereviewer_analyze
from .dimension_analyzer_runner import run_dimension_analyzer, SUPPORTED_ANALYZER_KEYS
import yaml

class ReviewOrchestrator:
    """Orchestrates the complete review process."""
    
    def __init__(self):
        self.security_analyzer = SecurityAnalyzer()
        self.semgrep_analyzer = SemgrepAnalyzer()
        self.lint_analyzer = LintAnalyzer()
        self.code_quality_analyzer = CodeQualityAnalyzer()
        self.iac_analyzer = IaCAnalyzer()
        self.accessibility_analyzer = AccessibilityAnalyzer()
        self.trufflehog_scanner = TruffleHogScanner()
        self.performance_analyzer = PerformanceDimensionAnalyzer()
        self.frontend_analyzer = FrontendDevToolsAnalyzer()
        self.lighthouse_service = LighthouseService()
        self.coverage_analyzer = CoverageAnalyzer()
        self.dependency_analyzer = DependencyAnalyzer()
        self.dead_code_analyzer = DeadCodeAnalyzer()
        self.duplicate_code_analyzer = DuplicateCodeAnalyzer()
        self.sonarqube_analyzer = SonarQubeAnalyzer()
        self.ai_service = AIReviewService()
    
    def analyze(self, files: List[Dict[str, Any]], repository_context: Optional[Dict] = None, diff_context: str = "") -> Dict[str, Any]:
        """
        Run complete analysis pipeline.
        
        Args:
            files: List of file dicts with 'path' and 'content'
            repository_context: Optional repository context (PR metadata)
            diff_context: Optional git diff string
            
        Returns:
            Complete review result
        """
        start_time = datetime.utcnow()
        full_code_review = bool(repository_context and repository_context.get("full_code_review"))
        if full_code_review:
            print("=" * 60)
            print(f"[DIR] Full-code review: orchestrator reading whole codebase ({len(files)} files)")
            print("=" * 60)
        
        # Step 0: Parse configuration (default: all tools on)
        config = self._parse_config(files)
        enabled_analyzers = {**DEFAULT_ANALYZERS, **(config.get('analyzers') or {})}
        
        # Step 1: Run CodeQL FIRST (deep security analysis)
        all_findings = []
        
        if enabled_analyzers.get('codeql', True) and repository_context:
            inst_id = repository_context.get('installation_id')
            repo_full_name = repository_context.get('full_name')
            if inst_id and repo_full_name:
                print("=" * 60)
                print("[SEARCH] STEP 1: Running CodeQL deep security analysis FIRST...")
                print("=" * 60)
                try:
                    codeql_analyzer = CodeQLAnalyzer(str(inst_id))
                    codeql_findings = codeql_analyzer.analyze(repo_full_name)
                    print(f"[OK] CodeQL found {len(codeql_findings)} security alerts")
                    all_findings.extend(codeql_findings)
                    
                    # Log CodeQL findings summary
                    if codeql_findings:
                        critical = sum(1 for f in codeql_findings if f.get('severity') == 'critical')
                        major = sum(1 for f in codeql_findings if f.get('severity') == 'major')
                        print(f"   [CHART] CodeQL breakdown: {critical} critical, {major} major, {len(codeql_findings) - critical - major} other")
                except Exception as e:
                    print(f"[WARN]️ Error running CodeQL analyzer: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                print("[WARN]️ CodeQL skipped: missing installation_id or repo_full_name")
        else:
            print("[INFO]️ CodeQL disabled or no repository context")
        
        # Step 2: Run other analyzers (after CodeQL)
        print("\n" + "=" * 60)
        print("[SEARCH] STEP 2: Running additional analyzers...")
        print("=" * 60)
        
        if enabled_analyzers.get('security', True):
            print("[SEARCH] Running security analyzer...")
            security_findings = self.security_analyzer.analyze(files)
            all_findings.extend(security_findings)
            print(f"   [OK] Security analyzer: {len(security_findings)} findings")

        if enabled_analyzers.get('dependencies', True):
            print("[SEARCH] Running dependency vulnerability scan (OSV.dev)...")
            try:
                dependency_findings = self.dependency_analyzer.analyze(files)
                all_findings.extend(dependency_findings)
                print(f"   [OK] Dependency analyzer: {len(dependency_findings)} findings")
            except Exception as _dep_err:
                print(f"   [WARN] Dependency analyzer error: {_dep_err}")

        if enabled_analyzers.get('dead_code', True):
            print("[SEARCH] Running dead code analyzer...")
            try:
                dead_code_findings = self.dead_code_analyzer.analyze(files)
                all_findings.extend(dead_code_findings)
                print(f"   [OK] Dead code analyzer: {len(dead_code_findings)} findings")
            except Exception as _dead_err:
                print(f"   [WARN] Dead code analyzer error: {_dead_err}")

        if enabled_analyzers.get('duplicate_code', True):
            print("[SEARCH] Running duplicate code analyzer...")
            try:
                dup_findings = self.duplicate_code_analyzer.analyze(files)
                all_findings.extend(dup_findings)
                print(f"   [OK] Duplicate code analyzer: {len(dup_findings)} findings")
            except Exception as _dup_err:
                print(f"   [WARN] Duplicate code analyzer error: {_dup_err}")

        if enabled_analyzers.get('trufflehog', True):
            print("[SEARCH] Running TruffleHog scanner...")
            truffle_findings = self.trufflehog_scanner.analyze(files)
            all_findings.extend(truffle_findings)
            print(f"   [OK] TruffleHog scanner: {len(truffle_findings)} findings")
        
        if enabled_analyzers.get('semgrep', True):
            print("[SEARCH] Running semgrep analyzer...")
            semgrep_findings = self.semgrep_analyzer.analyze(files)
            all_findings.extend(semgrep_findings)
            print(f"   [OK] Semgrep analyzer: {len(semgrep_findings)} findings")
        
        if enabled_analyzers.get('lint', True):
            print("[SEARCH] Running linting (Pylint/ESLint)...")
            lint_findings = self.lint_analyzer.analyze(files)
            # Tag with specific tool names based on file type
            for f in lint_findings:
                if f.get('file', '').endswith('.py'):
                    f['tool'] = 'pylint'
                elif f.get('file', '').endswith(('.js', '.ts', '.tsx')):
                    f['tool'] = 'eslint'
            all_findings.extend(lint_findings)
            print(f"   [OK] Lint analyzer: {len(lint_findings)} findings")

        if enabled_analyzers.get('performance', True):
            print("[SEARCH] Running performance & query analysis...")
            try:
                _perf_meta = {
                    "repo_id":        (repository_context or {}).get("repo_id", "unknown"),
                    "repo_full_name": (repository_context or {}).get("full_name", "unknown"),
                }
                perf_result   = self.performance_analyzer.run(_perf_meta, files)
                perf_findings = [
                    {
                        "module":       "performance",
                        "severity":     i.severity.lower().replace("high", "major").replace("medium", "minor").replace("low", "info"),
                        "category":     i.category_key,
                        "title":        i.title,
                        "description":  i.impact or i.recommendation,
                        "file":         i.file_paths[0] if i.file_paths else "",
                        "line":         None,
                        "code_snippet": "",
                        "confidence":   i.confidence,
                        "tool":         "performance_analyzer",
                        "suggested_fix": {"explanation": i.recommendation, "automated": False},
                    }
                    for i in perf_result.issues
                ]
                all_findings.extend(perf_findings)
                print(f"   [OK] Performance analyzer: {len(perf_findings)} findings "
                      f"(score={perf_result.category_result.score})")
            except Exception as _perf_err:
                print(f"   [WARN] Performance analyzer error: {_perf_err}")
            
        if enabled_analyzers.get('iac', True):
            print("[SEARCH] Running IaC analyzer...")
            iac_findings = self.iac_analyzer.analyze(files)
            all_findings.extend(iac_findings)
            print(f"   [OK] IaC analyzer: {len(iac_findings)} findings")
            
        if enabled_analyzers.get('accessibility', True):
            print("[SEARCH] Running Accessibility analyzer...")
            a11y_findings = self.accessibility_analyzer.analyze(files)
            all_findings.extend(a11y_findings)
            print(f"   [OK] Accessibility analyzer: {len(a11y_findings)} findings")

        if enabled_analyzers.get('maintainability', True):
            print("[SEARCH] Running Coverage analysis (Cobertura/OpenClover/JaCoCo)...")
            # Look for coverage/clover/jacoco files in files
            coverage_file = next((f for f in files if f.get('path', '').lower().endswith(('coverage.xml', 'clover.xml', 'jacoco.xml'))), None)
            if coverage_file:
                coverage_findings = self.coverage_analyzer.analyze(files, coverage_file.get('content'))
                all_findings.extend(coverage_findings)
                print(f"   [OK] Coverage analyzer: {len(coverage_findings)} findings")
            else:
                print("   [INFO]️ Skipping coverage: No supported coverage reports found (.xml)")

        if enabled_analyzers.get('frontend', True):
            print("[SEARCH] Running Chrome DevTools Performance analyzer...")
            frontend_findings = self.frontend_analyzer.analyze(files)
            all_findings.extend(frontend_findings)
            print(f"   [OK] Frontend DevTools analyzer: {len(frontend_findings)} findings")
            
            # Check for runtime Lighthouse audit
            app_url = config.get('app_url') or (repository_context.get('app_url') if repository_context else None)
            if app_url:
                print(f"[SEARCH] Running Lighthouse runtime audit for {app_url}...")
                lighthouse_findings = self.lighthouse_service.run_audit(app_url)
                all_findings.extend(lighthouse_findings)
                print(f"   [OK] Lighthouse: {len(lighthouse_findings)} findings")
        
        if enabled_analyzers.get('legacy_quality', False): # Default to False for legacy
            print("[SEARCH] Running legacy code quality analyzer...")
            quality_findings = self.code_quality_analyzer.analyze(files)
            all_findings.extend(quality_findings)
            print(f"   [OK] Code quality analyzer: {len(quality_findings)} findings")

        # SonarQube analyzer
        sonarqube_findings = []
        if enabled_analyzers.get('sonarqube', True):
            print("[SEARCH] Running SonarQube analysis...")
            try:
                project_key = (repository_context or {}).get('full_name', '').replace("/", "_") or 'codebuster'
                sonarqube_findings = self.sonarqube_analyzer.analyze(
                    project_key=project_key,
                    branch=repository_context.get('branch') if repository_context else None,
                )
                all_findings.extend(sonarqube_findings)
                print(f"   [OK] SonarQube: {len(sonarqube_findings)} findings")
            except Exception as e:
                print(f"   [WARN]️ SonarQube skipped: {e}")

        # Dimension analyzers (strict JSON contract) – optional; run with real repo + files
        dimension_results = {}
        if enabled_analyzers.get('dimension', True) and repository_context:
            repo_meta = {
                'repo_id': repository_context.get('repo_id', 'unknown'),
                'repo_full_name': repository_context.get('full_name', 'unknown'),
                'repo_url': repository_context.get('repo_url', 'unknown'),
                'commit_sha': repository_context.get('commit_sha', 'unknown'),
            }
            for key in SUPPORTED_ANALYZER_KEYS:
                try:
                    dim_result = run_dimension_analyzer(key, repo_meta, files, tool_logs=None)
                    dimension_results[key] = dim_result.to_json_dict()
                    # Merge dimension issues into all_findings (legacy shape) for AI step.
                    # We preserve impact, recommendation, tags, and effort under
                    # extra_metadata so the UI can render the AI agent's
                    # full output (especially for the 'ai' dimension whose tags
                    # like 'race-condition' / 'business-logic' are useful chips).
                    for i in dim_result.issues:
                        all_findings.append({
                            'id': i.id,
                            'title': i.title,
                            'severity': i.severity.lower(),
                            'category': i.category_key,
                            'file': i.file_paths[0] if i.file_paths else '',
                            'confidence': i.confidence,
                            'evidence': i.evidence,
                            'description': i.impact,
                            'tool': f'dimension_{i.category_key}',
                            'module': i.category_key,
                            # New: carry the LLM's actionable fields through to the
                            # Issue row so they survive persistence.
                            'recommendation': i.recommendation,
                            'tags': i.tags,
                            'effort': i.effort,
                        })
                    print(f"   [OK] Dimension ({key}): score={dim_result.category_result.score}, issues={len(dim_result.issues)}")
                except Exception as e:
                    print(f"   [INFO]️ Dimension ({key}) skipped: {e}")

        # CodeReviewer (Microsoft CodeBERT) – optional; runs when CODEREVIEWER_ENABLED=1
        if enabled_analyzers.get('codereviewer', True):
            try:
                cr_findings = codereviewer_analyze(files, diff_context=diff_context or "", repository_context=repository_context)
                if cr_findings:
                    all_findings.extend(cr_findings)
                    print(f"   [OK] CodeReviewer (CodeBERT): {len(cr_findings)} suggestions")
            except Exception as e:
                print(f"   [INFO]️ CodeReviewer skipped: {e}")
        
        print(f"\n[OK] Total findings from all analyzers: {len(all_findings)}")
        
        # Step 3: Deduplicate findings
        print("\n" + "=" * 60)
        print("[SEARCH] STEP 3: Deduplicating findings...")
        print("=" * 60)
        deduplicated = self._deduplicate_findings(all_findings)
        print(f"[OK] After deduplication: {len(deduplicated)} unique issues")
        
        # Step 3.5: Extract snippets for all findings to provide context to AI
        print("\n" + "=" * 60)
        print("[SEARCH] STEP 3.5: Extracting code snippets for AI context...")
        print("=" * 60)
        deduplicated = self._extract_snippets_for_findings(deduplicated, files)

        # Step 3.6: Trust-adjust confidence using reviewer feedback history.
        # Modules reviewers chronically dismiss (see the Finding Quality page)
        # get their confidence damped so they contribute less to prioritization
        # and the health-score penalty, without being silenced outright.
        try:
            from .finding_trust_service import apply_trust_adjustment
            deduplicated = apply_trust_adjustment(deduplicated)
        except Exception as e:
            print(f"   [INFO]️ Trust adjustment skipped: {e}")

        # Step 4: AI reasoning (after CodeQL and all analyzers)
        print("\n" + "=" * 60)
        print("[BOT] STEP 4: Running AI reasoning on all findings (CodeQL + analyzers)...")
        print("=" * 60)
        ai_result = self.ai_service.generate_review(deduplicated, repository_context)
        print(f"[OK] AI reasoning complete. Health score: {ai_result.get('overall_health_score', 'N/A')}")
        
        # Step 4.5: Enhance top issues with snippets and concrete fixes.
        # Runs in parallel (~6 workers) with per-call retries so a single
        # transient provider failure doesn't strip AI from a finding.
        print("\n" + "=" * 60)
        print("[BOT] STEP 4.5: Enhancing top issues with snippets and fixes...")
        print("=" * 60)

        prioritized = ai_result.get('prioritized_issues', [])
        # Issue count tuning:
        #   was 10 — covered ~half of a typical review
        #   25 — covers the visible set on the first scroll of the findings list
        TOP_N = 25
        targets = []
        for i, issue in enumerate(prioritized[:TOP_N]):
            file_path = issue.get('file') or issue.get('file_path')
            if not file_path:
                continue
            file_obj = next((f for f in files if f.get('path') == file_path), None)
            if not file_obj or not file_obj.get('content'):
                continue
            lang = 'python'
            if file_path.endswith(('.js', '.jsx', '.ts', '.tsx')):
                lang = 'javascript'
            elif file_path.endswith('.go'):
                lang = 'go'
            elif file_path.endswith('.java'):
                lang = 'java'
            elif file_path.endswith(('.rb',)):
                lang = 'ruby'
            elif file_path.endswith(('.rs',)):
                lang = 'rust'
            elif file_path.endswith(('.cs',)):
                lang = 'csharp'
            targets.append((i, issue, file_obj['content'], lang))

        ai_stats = {
            'attempted': 0,
            'enhanced': 0,
            'failed': 0,
            'cache_hits': 0,
            'provider': self.ai_service.provider,  # vertex|gemini|anthropic|openai|None
            'top_n': TOP_N,
        }
        if targets:
            ai_stats['attempted'] = len(targets)
            with ThreadPoolExecutor(max_workers=2) as pool:
                future_to_idx = {
                    pool.submit(
                        self.ai_service.enhance_issue_with_retry,
                        issue, content, lang,
                    ): i
                    for (i, issue, content, lang) in targets
                }
                for future in as_completed(future_to_idx):
                    i = future_to_idx[future]
                    try:
                        enhanced = future.result()
                        prioritized[i] = enhanced
                        if enhanced.get('ai_explanation'):
                            ai_stats['enhanced'] += 1
                            if enhanced.get('_ai_cache_hit'):
                                ai_stats['cache_hits'] += 1
                        else:
                            ai_stats['failed'] += 1
                    except Exception as exc:
                        ai_stats['failed'] += 1
                        print(f"   [WARN]️ enhancement task crashed for issue index {i}: {exc}")
            print(
                f"   [*] Enhanced {ai_stats['enhanced']}/{ai_stats['attempted']} issues "
                f"({ai_stats['failed']} fell back to rule-based, "
                f"{ai_stats['cache_hits']} from cache)"
            )
        else:
            print("   (no targets eligible for AI enhancement)")

        ai_result['prioritized_issues'] = prioritized
        ai_result['ai_stats'] = ai_stats

        # Step 4.6: Repo-level narrative executive summary.
        # One additional AI call that takes the top findings + score breakdown
        # and produces an opinionated, repo-specific narrative for the UI.
        # Skipped silently if AI is unavailable — rule-based summary stays in place.
        print("\n" + "=" * 60)
        print("[BOT] STEP 4.6: Generating executive summary...")
        print("=" * 60)
        try:
            exec_summary = self.ai_service.generate_executive_summary(
                prioritized,
                category_scores=ai_result.get('category_scores', {}) or {},
                overall_score=int(ai_result.get('overall_health_score') or 0),
            )
            if exec_summary:
                ai_result['executive_summary'] = exec_summary
                print("   [OK] executive summary generated")
            else:
                print("   (AI unavailable — using deterministic summary)")
        except Exception as exc:
            print(f"   [WARN]️ executive summary failed: {exc}")

        # Step 5: Format final result (consistent JSON formula)
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()

        # Build category_scores: merge AI + dimension results so all dimensions appear
        category_scores = dict(ai_result.get('category_scores', {}))
        for key, dim_data in dimension_results.items():
            if isinstance(dim_data, dict):
                cat = dim_data.get('category_result', {})
                if isinstance(cat, dict) and 'score' in cat:
                    category_scores[key] = category_scores.get(key, cat['score'])

        # Per-tool counts for transparent reporting
        by_tool: Dict[str, int] = {}
        for f in deduplicated:
            t = f.get('tool') or f.get('module') or 'unknown'
            by_tool[t] = by_tool.get(t, 0) + 1

        # Which analyzers actually ran (for canonical payload)
        analyzers_run_list = [k for k, v in enabled_analyzers.items() if v]
        summary_counts = {
            'total_issues': len(deduplicated),
            'critical': sum(1 for f in deduplicated if (f.get('severity') or '').lower() == 'critical'),
            'major': sum(1 for f in deduplicated if (f.get('severity') or '').lower() == 'major'),
            'minor': sum(1 for f in deduplicated if (f.get('severity') or '').lower() == 'minor'),
            'info': sum(1 for f in deduplicated if (f.get('severity') or '').lower() == 'info'),
        }
        summary_merged = {**summary_counts, **(ai_result.get('summary') or {})}

        result = {
            'review_id': None,
            'overall_health_score': ai_result.get('overall_health_score', 100),
            'category_scores': category_scores,
            'summary': summary_merged,
            # Narrative executive summary from the AI (Step 4.6). Schema:
            #   { executive_summary, top_risks_narrative[], fix_priority_order[],
            #     production_readiness, production_readiness_rationale }
            # May be None when AI is unavailable — frontend treats as optional.
            'executive_summary': ai_result.get('executive_summary'),
            # Per-run AI usage stats so the UI can show "AI: 23/25 enhanced".
            'ai_stats': ai_result.get('ai_stats'),
            'prioritized_issues': ai_result.get('prioritized_issues', deduplicated),
            'quick_wins': ai_result.get('quick_wins', []),
            'top_risks': ai_result.get('top_risks', []),
            'analysis_metadata': {
                'started_at': start_time.isoformat(),
                'completed_at': end_time.isoformat(),
                'duration_seconds': round(duration, 2),
                'analyzers_run': analyzers_run_list,
                'by_tool': by_tool,
                'files_analyzed': len(files),
                'lines_analyzed': sum(len((f.get('content') or '').split('\n')) for f in files),
            },
            'dimension_results': dimension_results,
            'raw_findings': deduplicated,
        }
        return result
    
    def _deduplicate_findings(self, findings: List[Dict]) -> List[Dict]:
        """Deduplicate findings (same issue, different tools)."""
        seen = {}
        
        for finding in findings:
            # Create key from file, line, and category
            file_path = finding.get('file', finding.get('file_path', 'unknown'))
            line = finding.get('line', finding.get('line_number'))
            category = finding.get('category', finding.get('module', 'unknown'))
            
            key = (file_path, line, category)
            
            if key in seen:
                # Merge: combine tools and increase confidence
                existing = seen[key]
                existing_tools = existing.get('tools', [existing.get('tool', 'unknown')])
                new_tool = finding.get('tool', 'unknown')
                
                if new_tool not in existing_tools:
                    existing_tools.append(new_tool)
                
                existing['tools'] = existing_tools
                existing['confidence'] = min(1.0, existing.get('confidence', 0.5) + 0.1)
                
                # Merge evidence
                existing_evidence = existing.get('evidence', [])
                new_evidence = finding.get('evidence', [])
                existing['evidence'] = list(set(existing_evidence + new_evidence))
            else:
                # Add ID if missing
                if 'id' not in finding:
                    finding['id'] = f"issue-{len(seen)+1:03d}"
                
                # Ensure tools is a list
                finding['tools'] = [finding.get('tool', 'unknown')]
                seen[key] = finding
        
        return list(seen.values())

    # Number of context lines above and below the issue line to include in the
    # snippet shown in the UI / sent to the AI for enhancement. Larger window =
    # more code context for the user, at the cost of more tokens for the LLM.
    # 20/20 → ~41-line snippet, comfortably fits a typical function + its caller.
    SNIPPET_CONTEXT_BEFORE = 20
    SNIPPET_CONTEXT_AFTER = 20

    def _extract_snippets_for_findings(self, findings: List[Dict], files: List[Dict]) -> List[Dict]:
        """Extract a code snippet around each finding (~17 lines) for UI + AI context."""
        file_map = {f.get('path'): f.get('content', '') for f in files if f.get('path')}

        before = self.SNIPPET_CONTEXT_BEFORE
        after = self.SNIPPET_CONTEXT_AFTER

        for f in findings:
            file_path = f.get('file', f.get('file_path'))
            line_no = f.get('line', f.get('line_number'))

            if not file_path or not line_no or f.get('code_snippet'):
                continue

            content = file_map.get(file_path)
            if not content:
                continue

            lines = content.splitlines()
            try:
                line_idx = int(line_no) - 1
                if 0 <= line_idx < len(lines):
                    start = max(0, line_idx - before)
                    end = min(len(lines), line_idx + after + 1)
                    snippet_lines = []
                    for i in range(start, end):
                        prefix = "--> " if i == line_idx else "    "
                        snippet_lines.append(f"{i+1:4} | {prefix}{lines[i]}")

                    f['code_snippet'] = "\n".join(snippet_lines)
            except (ValueError, TypeError):
                continue

        return findings

    def generate_sonarqube_enriched_report(
        self,
        sonarqube_findings: List[Dict],
        repository_context: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Generate the SonarQube + Awesome-Linters + Claude enriched report.

        This produces the standardized JSON output that combines SonarQube scan data,
        cross-referenced linter rules, and AI-generated descriptions and fixes.
        """
        mapper = AwesomeLintersMapper()
        enrichment_service = ClaudeEnrichmentService()

        # Cross-reference each finding with linter rules
        linter_refs: Dict[str, List[Dict]] = {}
        for finding in sonarqube_findings:
            finding_id = finding.get('id', '')
            rule_key = finding.get('sonarqube_rule_key', finding.get('rule_id', ''))
            issue_type = finding.get('sonarqube_type', '')
            file_path = finding.get('file', '')
            linter_refs[finding_id] = mapper.get_linter_references(rule_key, issue_type, file_path)

        # Claude enrichment
        project_name = 'codebuster'
        if repository_context:
            project_name = repository_context.get('full_name', 'codebuster').split('/')[-1]

        return enrichment_service.enrich_findings(
            sonarqube_findings, linter_refs,
            project_name=project_name,
            repository_context=repository_context,
        )

    def _parse_config(self, files: List[Dict]) -> Dict:
        """Parse .codebuster.yaml from file list."""
        for file in files:
            if file.get('path') == '.codebuster.yaml':
                try:
                    return yaml.safe_load(file.get('content', '')) or {}
                except Exception as e:
                    print(f"[WARN]️ Error parsing .codebuster.yaml: {e}")
        return {}

