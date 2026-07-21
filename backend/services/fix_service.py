"""Fix service - handles one-click fix application to GitHub."""
import requests
import base64
import os
import re
import difflib
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

# File extension -> (language id, comment prefix, env-access template)
_LANG_MAP = {
    '.py':   ('python',      '#',  "os.getenv('{var}')"),
    '.js':   ('javascript',  '//', "process.env.{var}"),
    '.mjs':  ('javascript',  '//', "process.env.{var}"),
    '.cjs':  ('javascript',  '//', "process.env.{var}"),
    '.jsx':  ('javascript',  '//', "process.env.{var}"),
    '.ts':   ('typescript',  '//', "process.env.{var}"),
    '.tsx':  ('typescript',  '//', "process.env.{var}"),
    '.dart': ('dart',        '//', "const String.fromEnvironment('{var}')"),
    '.go':   ('go',          '//', "os.Getenv(\"{var}\")"),
    '.java': ('java',        '//', "System.getenv(\"{var}\")"),
    '.kt':   ('kotlin',      '//', "System.getenv(\"{var}\")"),
    '.rb':   ('ruby',        '#',  "ENV['{var}']"),
    '.rs':   ('rust',        '//', "std::env::var(\"{var}\").unwrap_or_default()"),
    '.php':  ('php',         '//', "getenv('{var}')"),
    '.cs':   ('csharp',      '//', "Environment.GetEnvironmentVariable(\"{var}\")"),
}

_SECRET_CATEGORIES = {'secret_leak', 'high_entropy_secret'}


class FixService:
    """Service to apply code fixes to GitHub via the App."""

    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            'Authorization': f'token {access_token}',
            'Accept': 'application/vnd.github.v3+json'
        }

    def preview_fix(self, repo_full_name: str, file_path: str, issue: Any) -> Dict[str, Any]:
        """
        Compute the fix patch WITHOUT touching GitHub. Returns a description of
        what the fix will change so the user can review before committing.
        """
        try:
            file_response = requests.get(
                f"https://api.github.com/repos/{repo_full_name}/contents/{file_path}",
                headers=self.headers,
            )
            if file_response.status_code != 200:
                return {
                    "success": False,
                    "error": self._format_gh_error("Failed to fetch file", file_response),
                }
            file_data = file_response.json()
            current_content = base64.b64decode(file_data['content']).decode('utf-8')

            category = (getattr(issue, 'category', None) or '').lower()
            suggested_fix = issue.get_suggested_fix() or {}
            # Accept both shapes: deterministic analyzers write `.code`,
            # AI enhancement writes `.content`. Some paths populate both.
            fix_code = suggested_fix.get('code') or suggested_fix.get('content')
            original_snippet = issue.code_snippet
            commit_summary = None

            if category in _SECRET_CATEGORIES:
                new_content, redaction = self._redact_secret(
                    current_content, file_path, issue.line_number, getattr(issue, 'title', '')
                )
                if new_content == current_content:
                    return {"success": False, "error": "Could not locate the secret literal to redact."}
                commit_summary = redaction
                strategy = "secret-redaction"
            else:
                if not fix_code:
                    return {"success": False, "error": "No fix code available for this issue."}
                # Guardrail (matches apply_fix): refuse comment-only "fixes"
                # so the preview never shows a diff that would replace the
                # buggy line with a bare comment.
                if not self._is_meaningful_code_fix(fix_code, file_path):
                    return {
                        "success": False,
                        "error": (
                            "The suggested fix is just a comment, not a code replacement. "
                            "Run AI enhancement on this finding to get an actual code solution, "
                            "or write the fix manually."
                        ),
                        "comment_only_fix": True,
                    }
                new_content = self._apply_code_fix(current_content, original_snippet, fix_code)
                strategy = "snippet-replace"
                if new_content == current_content:
                    new_content = self._apply_line_fix(current_content, issue.line_number, fix_code)
                    strategy = "line-replace"
                if new_content == current_content:
                    return {"success": False, "error": "Could not locate code to fix automatically."}

            diff = self._unified_diff(current_content, new_content, file_path)
            before_line, after_line = self._focus_lines(
                current_content, new_content, issue.line_number
            )

            language, _, _ = self._language_info(file_path)

            description_parts = []
            if category in _SECRET_CATEGORIES:
                description_parts.append(
                    f"Replace the hardcoded secret literal on line {issue.line_number} "
                    f"with a lookup into the `{self._env_var_name(getattr(issue, 'title', ''), file_path)}` "
                    f"environment variable ({language})."
                )
                description_parts.append(
                    "You must rotate the exposed value — this fix only stops future leaks, "
                    "the original secret is already in git history."
                )
            else:
                description_parts.append(
                    f"Apply CodeBuster's suggested patch at `{file_path}:{issue.line_number}` "
                    f"using {strategy} strategy ({language})."
                )
                if getattr(issue, 'description', None):
                    description_parts.append(issue.description)

            return {
                "success": True,
                "file_path": file_path,
                "line_number": issue.line_number,
                "language": language,
                "strategy": strategy,
                "category": category or 'general',
                "description": "\n\n".join(description_parts),
                # The problem itself, kept separate from the fix description
                # above — so the preview can show "here's what's wrong"
                # right next to "here's the diff that fixes it" instead of
                # making the reviewer go dig for the issue's own summary.
                "problem_title": getattr(issue, 'title', None),
                "problem_description": getattr(issue, 'description', None),
                "problem_severity": getattr(issue, 'severity', None),
                "problem_evidence": (issue.get_evidence() if hasattr(issue, 'get_evidence') else None) or [],
                "commit_summary": commit_summary,
                "before": before_line,
                "after": after_line,
                "diff": diff,
                "stats": self._diff_stats(current_content, new_content),
                "branch_preview": f"fix/codebuster-{issue.id[:8]}-<timestamp>",
                "commit_message": f"CodeBuster: Apply fix for {getattr(issue, 'title', 'issue')}",
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    def _unified_diff(before: str, after: str, file_path: str) -> str:
        diff_iter = difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile=f"a/{file_path}",
            tofile=f"b/{file_path}",
            n=3,
        )
        return "".join(diff_iter)

    @staticmethod
    def _focus_lines(before: str, after: str, line_number: Optional[int]) -> Tuple[str, str]:
        """Return the (before_line, after_line) at `line_number` for compact display."""
        if not line_number:
            return '', ''
        b_lines = before.splitlines()
        a_lines = after.splitlines()
        b = b_lines[line_number - 1] if 1 <= line_number <= len(b_lines) else ''
        a = a_lines[line_number - 1] if 1 <= line_number <= len(a_lines) else ''
        return b, a

    @staticmethod
    def _diff_stats(before: str, after: str) -> Dict[str, int]:
        added = 0
        removed = 0
        for line in difflib.unified_diff(before.splitlines(), after.splitlines(), n=0):
            if line.startswith('+') and not line.startswith('+++'):
                added += 1
            elif line.startswith('-') and not line.startswith('---'):
                removed += 1
        return {"added": added, "removed": removed}

    def _compute_single_fix(self, current_content: str, file_path: str, issue: Any) -> Dict[str, Any]:
        """
        Compute the new file content for one issue's fix, with no GitHub I/O.
        Factored out fresh for apply_fix_sprint (batch fixing) — deliberately
        not shared with apply_fix/preview_fix's inline logic, so the
        already-relied-upon single-issue flows can't regress from this change.

        Returns {"success": True, "new_content", "commit_summary"} or
        {"success": False, "error", "comment_only_fix"?}.
        """
        suggested_fix = issue.get_suggested_fix() or {}
        fix_code = suggested_fix.get('code') or suggested_fix.get('content')
        original_snippet = issue.code_snippet
        category = (getattr(issue, 'category', None) or '').lower()

        if category in _SECRET_CATEGORIES:
            new_content, redaction = self._redact_secret(
                current_content, file_path, issue.line_number, getattr(issue, 'title', '')
            )
            if new_content == current_content:
                return {"success": False, "error": "Could not locate the secret literal to redact."}
            return {"success": True, "new_content": new_content, "commit_summary": redaction}

        if not fix_code:
            return {"success": False, "error": "No fix code available for this issue."}
        if not self._is_meaningful_code_fix(fix_code, file_path):
            return {
                "success": False,
                "error": "The suggested fix is just a comment, not a code replacement.",
                "comment_only_fix": True,
            }

        new_content = self._apply_code_fix(current_content, original_snippet, fix_code)
        if new_content == current_content:
            new_content = self._apply_line_fix(current_content, issue.line_number, fix_code)
        if new_content == current_content:
            return {"success": False, "error": "Could not locate code to fix automatically."}
        return {"success": True, "new_content": new_content, "commit_summary": None}

    def apply_ai_fix_pr(self, repo_full_name: str, file_path: str, issue: Any, ai_review_service: Any) -> Dict[str, Any]:
        """
        Generate a fix with GPT-5.6 (via AIReviewService.generate_fix_patch)
        and open a real PR from it — the AI writes the whole corrected file,
        rather than splicing in the analyzer's canned suggested_fix.code.
        """
        try:
            perm_error = self._preflight_permissions(repo_full_name)
            if perm_error:
                return {"success": False, "error": perm_error}

            file_response = requests.get(
                f"https://api.github.com/repos/{repo_full_name}/contents/{file_path}",
                headers=self.headers,
            )
            if file_response.status_code != 200:
                return {"success": False, "error": f"Failed to fetch file: {file_response.status_code}"}

            file_data = file_response.json()
            current_content = base64.b64decode(file_data['content']).decode('utf-8')
            sha = file_data['sha']

            language = (_LANG_MAP.get(os.path.splitext(file_path)[1], ('text',))[0])
            issue_dict = issue if isinstance(issue, dict) else {
                'title': getattr(issue, 'title', ''),
                'category': getattr(issue, 'category', ''),
                'severity': getattr(issue, 'severity', 'minor'),
                'file': file_path,
                'line': getattr(issue, 'line_number', 0),
                'description': getattr(issue, 'description', ''),
            }

            patch = ai_review_service.generate_fix_patch(issue_dict, current_content, language)
            if not patch or not patch.get('new_content'):
                return {"success": False, "error": "AI could not generate a fix for this issue."}

            new_content = patch['new_content']
            if new_content == current_content:
                return {"success": False, "error": "AI returned no changes for this issue."}

            timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
            issue_id = getattr(issue, 'id', None) or issue_dict.get('id') or 'ai'
            new_branch = f"fix/codebuster-ai-{str(issue_id)[:8]}-{timestamp}"

            repo_info_resp = requests.get(
                f"https://api.github.com/repos/{repo_full_name}", headers=self.headers
            )
            if repo_info_resp.status_code != 200:
                return {"success": False, "error": self._format_gh_error("Failed to fetch repository info", repo_info_resp)}
            default_branch = repo_info_resp.json().get('default_branch', 'main')

            ref_response = requests.get(
                f"https://api.github.com/repos/{repo_full_name}/git/ref/heads/{default_branch}",
                headers=self.headers,
            )
            if ref_response.status_code != 200:
                return {"success": False, "error": self._format_gh_error(f"Failed to read default branch `{default_branch}`", ref_response)}
            try:
                base_sha = ref_response.json()['object']['sha']
            except (KeyError, ValueError):
                return {"success": False, "error": f"Unexpected response when reading `{default_branch}` ref."}

            branch_response = requests.post(
                f"https://api.github.com/repos/{repo_full_name}/git/refs",
                headers=self.headers,
                json={"ref": f"refs/heads/{new_branch}", "sha": base_sha},
            )
            if branch_response.status_code != 201:
                return {"success": False, "error": self._format_gh_error("Failed to create branch", branch_response, context_branch=new_branch)}

            commit_message = patch['commit_message']
            commit_response = requests.put(
                f"https://api.github.com/repos/{repo_full_name}/contents/{file_path}",
                headers=self.headers,
                json={
                    "message": commit_message,
                    "content": base64.b64encode(new_content.encode('utf-8')).decode('utf-8'),
                    "sha": sha,
                    "branch": new_branch,
                },
            )
            if commit_response.status_code not in (200, 201):
                return {"success": False, "error": self._format_gh_error("Failed to commit fix", commit_response, context_branch=new_branch)}

            commit_json = commit_response.json()
            commit_sha = commit_json.get('commit', {}).get('sha')
            commit_html_url = commit_json.get('commit', {}).get('html_url')

            pr_info = self._open_pull_request(
                repo_full_name=repo_full_name,
                head_branch=new_branch,
                base_branch=default_branch,
                issue=issue,
                commit_summary=patch.get('summary'),
            )

            result = {
                "success": True,
                "branch": new_branch,
                "commit_sha": commit_sha,
                "html_url": (pr_info or {}).get('html_url') or commit_html_url,
                "commit_url": commit_html_url,
                "ai_summary": patch.get('summary'),
            }
            if pr_info and pr_info.get('html_url'):
                result["pr_url"] = pr_info['html_url']
                result["pr_number"] = pr_info.get('number')
            elif pr_info and pr_info.get('error'):
                result["pr_warning"] = pr_info['error']
            return result

        except Exception as e:
            return {"success": False, "error": str(e)}

    def apply_fix_sprint(self, repo_full_name: str, issues: List[Any]) -> Dict[str, Any]:
        """
        "Fix Sprint": batch-fix several issues in ONE branch, with one commit
        per touched file, ending in ONE pull request with an AI-written
        summary of everything that changed (and what couldn't be fixed
        automatically, and why).
        """
        try:
            perm_error = self._preflight_permissions(repo_full_name)
            if perm_error:
                return {"success": False, "error": perm_error}
            if not issues:
                return {"success": False, "error": "No issues provided."}

            repo_info_resp = requests.get(f"https://api.github.com/repos/{repo_full_name}", headers=self.headers)
            if repo_info_resp.status_code != 200:
                return {"success": False, "error": self._format_gh_error("Failed to fetch repository info", repo_info_resp)}
            default_branch = repo_info_resp.json().get('default_branch', 'main')

            ref_response = requests.get(
                f"https://api.github.com/repos/{repo_full_name}/git/ref/heads/{default_branch}",
                headers=self.headers,
            )
            if ref_response.status_code != 200:
                return {"success": False, "error": self._format_gh_error(f"Failed to read default branch `{default_branch}`", ref_response)}
            try:
                base_sha = ref_response.json()['object']['sha']
            except (KeyError, ValueError):
                return {"success": False, "error": f"Unexpected response when reading `{default_branch}` ref."}

            timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
            new_branch = f"fix/codebuster-sprint-{timestamp}"
            branch_response = requests.post(
                f"https://api.github.com/repos/{repo_full_name}/git/refs",
                headers=self.headers,
                json={"ref": f"refs/heads/{new_branch}", "sha": base_sha},
            )
            if branch_response.status_code != 201:
                return {"success": False, "error": self._format_gh_error("Failed to create branch", branch_response, context_branch=new_branch)}

            # Group by file so every fix that touches the same file lands in
            # a single commit instead of racing each other over stale SHAs.
            by_file: Dict[str, List[Any]] = {}
            for issue in issues:
                by_file.setdefault(issue.file_path, []).append(issue)

            applied: List[Dict[str, Any]] = []
            skipped: List[Dict[str, Any]] = []
            commits: List[Dict[str, Any]] = []

            for file_path, file_issues in by_file.items():
                file_response = requests.get(
                    f"https://api.github.com/repos/{repo_full_name}/contents/{file_path}",
                    headers=self.headers,
                    params={"ref": new_branch},
                )
                if file_response.status_code != 200:
                    for issue in file_issues:
                        skipped.append({
                            "issue_id": issue.id, "title": issue.title, "file_path": file_path,
                            "reason": f"Failed to fetch file (HTTP {file_response.status_code})",
                        })
                    continue

                file_data = file_response.json()
                content = base64.b64decode(file_data['content']).decode('utf-8')
                sha = file_data['sha']
                original_content = content
                file_commit_summaries = []
                file_applied: List[Dict[str, Any]] = []

                for issue in file_issues:
                    fix_result = self._compute_single_fix(content, file_path, issue)
                    if not fix_result.get("success"):
                        skipped.append({
                            "issue_id": issue.id, "title": issue.title, "file_path": file_path,
                            "reason": fix_result.get("error", "Could not compute fix."),
                        })
                        continue
                    content = fix_result["new_content"]
                    file_applied.append({
                        "issue_id": issue.id, "title": issue.title, "file_path": file_path,
                        "severity": getattr(issue, 'severity', None),
                    })
                    if fix_result.get("commit_summary"):
                        file_commit_summaries.append(fix_result["commit_summary"])

                if content == original_content:
                    continue  # nothing applied to this file

                commit_message = self._build_sprint_commit_message(file_path, file_issues, file_commit_summaries)
                commit_response = requests.put(
                    f"https://api.github.com/repos/{repo_full_name}/contents/{file_path}",
                    headers=self.headers,
                    json={
                        "message": commit_message,
                        "content": base64.b64encode(content.encode('utf-8')).decode('utf-8'),
                        "sha": sha,
                        "branch": new_branch,
                    },
                )
                if commit_response.status_code not in (200, 201):
                    # The branch still has the old content for this file — move
                    # everything we tentatively "applied" here back to skipped.
                    for entry in file_applied:
                        skipped.append({**entry, "reason": self._format_gh_error("Failed to commit fix", commit_response)})
                    continue

                applied.extend(file_applied)
                commit_json = commit_response.json()
                commits.append({
                    "file_path": file_path,
                    "commit_sha": commit_json.get('commit', {}).get('sha'),
                    "commit_url": commit_json.get('commit', {}).get('html_url'),
                })

            if not applied:
                return {
                    "success": False,
                    "error": "Could not automatically fix any of the selected issues.",
                    "skipped": skipped,
                }

            pr_info = self._open_sprint_pull_request(
                repo_full_name=repo_full_name,
                head_branch=new_branch,
                base_branch=default_branch,
                applied=applied,
                skipped=skipped,
            )

            result = {
                "success": True,
                "branch": new_branch,
                "applied": applied,
                "skipped": skipped,
                "commits": commits,
                "html_url": (pr_info or {}).get('html_url'),
            }
            if pr_info and pr_info.get('html_url'):
                result["pr_url"] = pr_info['html_url']
                result["pr_number"] = pr_info.get('number')
            elif pr_info and pr_info.get('error'):
                result["pr_warning"] = pr_info['error']
            return result

        except Exception as e:
            return {"success": False, "error": str(e)}

    def _build_sprint_commit_message(self, file_path: str, file_issues: List[Any], commit_summaries: List[str]) -> str:
        """Commit message covering every fix applied to one file in a sprint."""
        titles = [getattr(issue, 'title', 'issue') for issue in file_issues][:5]
        subject = f"fix({file_path.rsplit('/', 1)[-1]}): {len(file_issues)} CodeBuster fix(es)"
        body_parts = [f"- {t}" for t in titles]
        body_parts.append("Part of a CodeBuster Fix Sprint. Review diff before merging.")
        if commit_summaries:
            body_parts.extend(commit_summaries)
        return subject[:72] + "\n\n" + "\n".join(body_parts)

    def _open_sprint_pull_request(
        self,
        repo_full_name: str,
        head_branch: str,
        base_branch: str,
        applied: List[Dict[str, Any]],
        skipped: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Open the single PR for a Fix Sprint. AI-written body with a template fallback."""
        title = f"CodeBuster Fix Sprint: {len(applied)} issue(s) resolved"

        ai_body = None
        try:
            from .ai_review_service import AIReviewService
            ai_body = AIReviewService().summarize_fix_sprint(applied, skipped, repo_full_name)
        except Exception:
            ai_body = None

        if ai_body:
            body = ai_body
        else:
            sev_emoji = {'critical': '🔴', 'major': '🟠', 'minor': '🟡'}
            lines = [
                "## 🤖 CodeBuster Fix Sprint",
                "",
                f"This PR batches automatic fixes for **{len(applied)} issue(s)** found by CodeBuster.",
                "",
                "### Fixed",
            ]
            for a in applied[:20]:
                emoji = sev_emoji.get((a.get('severity') or '').lower(), '⚪')
                lines.append(f"- {emoji} `{a.get('file_path')}` — {a.get('title')}")
            if skipped:
                lines += ["", "### Not included (no safe automatic fix)"]
                for s in skipped[:10]:
                    lines.append(f"- `{s.get('file_path')}` — {s.get('title')}: {s.get('reason')}")
            lines += ["", "---", "_CodeBuster patches are best-effort. Always review the diff before merging._"]
            body = "\n".join(lines)

        try:
            resp = requests.post(
                f"https://api.github.com/repos/{repo_full_name}/pulls",
                headers=self.headers,
                json={
                    "title": title,
                    "head": head_branch,
                    "base": base_branch,
                    "body": body,
                    "maintainer_can_modify": True,
                },
            )
        except Exception as e:
            return {"error": f"PR request failed: {e}"}

        if resp.status_code in (200, 201):
            data = resp.json()
            return {"html_url": data.get('html_url'), "number": data.get('number')}
        return {
            "error": self._format_gh_error(
                "Branch pushed, but failed to open PR", resp, context_branch=head_branch
            )
        }

    def apply_fix(self, repo_full_name: str, file_path: str, issue: Any) -> Dict[str, Any]:
        """
        Apply a suggested fix to a file on GitHub.

        Args:
            repo_full_name: owner/repo
            file_path: path to the file
            issue: The Issue model instance
            
        Returns:
            Dict with success status and commit info
        """
        try:
            # 0. Preflight: verify the installation token grants contents:write.
            #    This saves a round-trip and gives a precise actionable error.
            perm_error = self._preflight_permissions(repo_full_name)
            if perm_error:
                return {"success": False, "error": perm_error}

            # 1. Get current file content and SHA
            file_response = requests.get(
                f"https://api.github.com/repos/{repo_full_name}/contents/{file_path}",
                headers=self.headers
            )
            
            if file_response.status_code != 200:
                return {"success": False, "error": f"Failed to fetch file: {file_response.status_code}"}
                
            file_data = file_response.json()
            current_content = base64.b64decode(file_data['content']).decode('utf-8')
            sha = file_data['sha']
            
            # 2. Build a language-appropriate patch
            suggested_fix = issue.get_suggested_fix() or {}
            # Accept both shapes — `.code` from deterministic analyzers and
            # `.content` from the AI service. The on-demand enhance flow
            # writes both, but older rows may only have one.
            fix_code = suggested_fix.get('code') or suggested_fix.get('content')
            original_snippet = issue.code_snippet
            category = (getattr(issue, 'category', None) or '').lower()

            new_content = current_content
            # Secret-leak fixes are handled specially: redact just the literal
            # in the correct language syntax instead of line-replacing with a
            # (possibly wrong-language) snippet from the analyzer.
            if category in _SECRET_CATEGORIES:
                new_content, redaction = self._redact_secret(
                    current_content, file_path, issue.line_number, getattr(issue, 'title', '')
                )
                if new_content == current_content:
                    return {
                        "success": False,
                        "error": "Could not locate the secret literal to redact.",
                    }
                commit_summary = redaction
            else:
                if not fix_code:
                    return {
                        "success": False,
                        "error": (
                            "No fix code available. The deterministic analyzer didn't "
                            "produce a real replacement. Run AI enhancement on this "
                            "issue first, or fix it manually."
                        ),
                    }

                # Guardrail: refuse to overwrite the bug line with a
                # comment-only "fix" (many analyzers emit '# Move to env var'
                # or '# Use safe alternatives' as their .code field). Applying
                # those literally deletes the user's working line and leaves
                # a bare comment — strictly worse than the original bug.
                if not self._is_meaningful_code_fix(fix_code, file_path):
                    return {
                        "success": False,
                        "error": (
                            "The suggested fix is just a comment, not a code replacement — "
                            "applying it would delete your line. Run AI enhancement on this "
                            "finding to get an actual code solution, or write the fix manually."
                        ),
                        "comment_only_fix": True,
                    }

                new_content = self._apply_code_fix(current_content, original_snippet, fix_code)

                if new_content == current_content:
                    new_content = self._apply_line_fix(current_content, issue.line_number, fix_code)

                if new_content == current_content:
                    return {"success": False, "error": "Could not locate code to fix manually"}
                commit_summary = None
                
            # 3. Create a unique branch name
            timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
            new_branch = f"fix/codebuster-{issue.id[:8]}-{timestamp}"

            # Get default branch
            repo_info_resp = requests.get(
                f"https://api.github.com/repos/{repo_full_name}", headers=self.headers
            )
            if repo_info_resp.status_code != 200:
                return {
                    "success": False,
                    "error": self._format_gh_error(
                        "Failed to fetch repository info", repo_info_resp
                    ),
                }
            default_branch = repo_info_resp.json().get('default_branch', 'main')

            # Resolve base SHA of default branch
            ref_response = requests.get(
                f"https://api.github.com/repos/{repo_full_name}/git/ref/heads/{default_branch}",
                headers=self.headers,
            )
            if ref_response.status_code != 200:
                return {
                    "success": False,
                    "error": self._format_gh_error(
                        f"Failed to read default branch `{default_branch}`", ref_response
                    ),
                }
            try:
                base_sha = ref_response.json()['object']['sha']
            except (KeyError, ValueError):
                return {
                    "success": False,
                    "error": f"Unexpected response when reading `{default_branch}` ref.",
                }

            # Create new branch
            branch_response = requests.post(
                f"https://api.github.com/repos/{repo_full_name}/git/refs",
                headers=self.headers,
                json={
                    "ref": f"refs/heads/{new_branch}",
                    "sha": base_sha,
                },
            )

            if branch_response.status_code != 201:
                return {
                    "success": False,
                    "error": self._format_gh_error(
                        "Failed to create branch", branch_response, context_branch=new_branch
                    ),
                }
                
            # 4. Commit change to new branch
            commit_message = self._build_commit_message(issue, commit_summary, new_content, current_content, file_path)
            if commit_summary and commit_summary not in commit_message:
                commit_message += f"\n\n{commit_summary}"
            commit_response = requests.put(
                f"https://api.github.com/repos/{repo_full_name}/contents/{file_path}",
                headers=self.headers,
                json={
                    "message": commit_message,
                    "content": base64.b64encode(new_content.encode('utf-8')).decode('utf-8'),
                    "sha": sha,
                    "branch": new_branch
                }
            )
            
            if commit_response.status_code not in [200, 201]:
                return {
                    "success": False,
                    "error": self._format_gh_error(
                        "Failed to commit fix", commit_response, context_branch=new_branch
                    ),
                }

            commit_json = commit_response.json()
            commit_sha = commit_json.get('commit', {}).get('sha')
            commit_html_url = commit_json.get('commit', {}).get('html_url')

            # 5. Open a PR from the fix branch back into the default branch.
            # Non-fatal: if PR creation fails (e.g. PR write perm missing), the
            # branch is still pushed and the user can open a PR manually.
            pr_info = self._open_pull_request(
                repo_full_name=repo_full_name,
                head_branch=new_branch,
                base_branch=default_branch,
                issue=issue,
                commit_summary=commit_summary,
            )

            result = {
                "success": True,
                "branch": new_branch,
                "commit_sha": commit_sha,
                "html_url": (pr_info or {}).get('html_url') or commit_html_url,
                "commit_url": commit_html_url,
            }
            if pr_info and pr_info.get('html_url'):
                result["pr_url"] = pr_info['html_url']
                result["pr_number"] = pr_info.get('number')
            elif pr_info and pr_info.get('error'):
                result["pr_warning"] = pr_info['error']
            return result

        except Exception as e:
            return {"success": False, "error": str(e)}

    def _build_commit_message(
        self,
        issue: Any,
        commit_summary: Optional[str],
        new_content: str,
        old_content: str,
        file_path: str,
    ) -> str:
        """
        Build a conventional-commit message. Tries OpenAI if configured;
        falls back to a structured template so the commit is always useful.
        """
        severity  = (getattr(issue, 'severity', '') or '').lower()
        category  = (getattr(issue, 'category', '') or getattr(issue, 'module', '') or '').lower()
        title     = (getattr(issue, 'title', '') or 'issue').strip()
        desc      = (getattr(issue, 'description', '') or '').strip()[:300]

        # Conventional commit type mapping
        commit_type = {
            'critical': 'fix!',
            'major':    'fix',
            'minor':    'refactor',
        }.get(severity, 'fix')

        # Scope from category
        scope_map = {
            'secret_leak':           'security',
            'high_entropy_secret':   'security',
            'sql_injection':         'security',
            'xss':                   'security',
            'command_injection':     'security',
            'n_plus_one_query':      'perf',
            'sql_efficiency':        'perf',
            'complexity':            'complexity',
            'file_length':           'style',
            'logging':               'logging',
        }
        scope = scope_map.get(category, category.replace('_', '-') if category else 'fix')

        # Diff stats for context
        old_lines = old_content.splitlines()
        new_lines = new_content.splitlines()
        added   = sum(1 for l in difflib.unified_diff(old_lines, new_lines, n=0) if l.startswith('+') and not l.startswith('+++'))
        removed = sum(1 for l in difflib.unified_diff(old_lines, new_lines, n=0) if l.startswith('-') and not l.startswith('---'))

        # Short subject line (≤72 chars)
        subject = f"{commit_type}({scope}): {title[:60]}"

        body_parts = []
        if desc:
            body_parts.append(desc)
        body_parts.append(f"File: {file_path} (+{added} −{removed} lines)")
        if commit_summary:
            body_parts.append(commit_summary)
        body_parts.append("Automated fix applied by CodeBuster. Review diff before merging.")

        return subject + "\n\n" + "\n\n".join(body_parts)

    def _open_pull_request(
        self,
        repo_full_name: str,
        head_branch: str,
        base_branch: str,
        issue: Any,
        commit_summary: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """Open a PR from head_branch → base_branch. Returns {html_url, number} or {error}."""
        title = f"CodeBuster: {getattr(issue, 'title', 'Apply fix')}"

        severity  = getattr(issue, 'severity', 'unknown')
        category  = getattr(issue, 'category', None) or getattr(issue, 'module', 'n/a')
        file_ref  = f"`{getattr(issue, 'file_path', '')}`"
        if getattr(issue, 'line_number', None):
            file_ref += f":{issue.line_number}"

        sev_emoji = {'critical': '🔴', 'major': '🟠', 'minor': '🟡'}.get((severity or '').lower(), '⚪')

        body_lines = [
            "## 🤖 CodeBuster Automated Fix",
            "",
            f"This PR was generated by **CodeBuster** to resolve a `{severity}` finding.",
            "",
            "### Finding",
            f"| Field | Value |",
            f"|---|---|",
            f"| {sev_emoji} Severity | `{severity}` |",
            f"| Category | `{category}` |",
            f"| File | {file_ref} |",
            f"| Issue ID | `{issue.id}` |",
        ]

        description = getattr(issue, 'description', None)
        if description:
            body_lines += ["", "### Why this matters", f"> {description}"]

        if commit_summary:
            body_lines += ["", "### What CodeBuster changed", commit_summary]

        body_lines += [
            "",
            "### Review checklist",
            "- [ ] Diff looks correct and doesn't break any existing behaviour",
            "- [ ] Tests pass (run CI before merging)",
        ]
        if category in ('secret_leak', 'high_entropy_secret'):
            body_lines += [
                "- [ ] **Rotate the original secret** — it is already in git history and must be revoked",
                "- [ ] Set the new environment variable in all deployment environments",
            ]
        body_lines += [
            "",
            "---",
            "_CodeBuster patches are best-effort. Always review the diff before merging._",
        ]

        try:
            resp = requests.post(
                f"https://api.github.com/repos/{repo_full_name}/pulls",
                headers=self.headers,
                json={
                    "title": title,
                    "head": head_branch,
                    "base": base_branch,
                    "body": "\n".join(body_lines),
                    "maintainer_can_modify": True,
                },
            )
        except Exception as e:
            return {"error": f"PR request failed: {e}"}

        if resp.status_code in (200, 201):
            data = resp.json()
            return {"html_url": data.get('html_url'), "number": data.get('number')}
        return {
            "error": self._format_gh_error(
                "Branch pushed, but failed to open PR", resp, context_branch=head_branch
            )
        }

    def _preflight_permissions(self, repo_full_name: str) -> Optional[str]:
        """
        Ask the installation API what permissions this token actually has.
        Returns None if OK, or a user-facing error string if `contents:write` is missing.
        Never raises — if the check itself fails we fall through and let the real
        API call produce its own error.
        """
        try:
            owner = repo_full_name.split('/', 1)[0] if repo_full_name else ''
            # Use the meta endpoint that echoes token permissions. This works for
            # any installation token and doesn't consume extra rate budget.
            resp = requests.get(
                "https://api.github.com/installation/repositories?per_page=1",
                headers={**self.headers, 'Accept': 'application/vnd.github+json'},
            )
        except Exception:
            return None  # Preflight is best-effort.

        if resp.status_code != 200:
            return None

        # GitHub returns the installation's current permissions in the response
        # headers for installation-token calls.
        perms_header = resp.headers.get('x-accepted-github-permissions', '')
        # Format: "contents=write,metadata=read,..." or similar comma-separated list.
        # Parse loosely — if we can't parse, skip the check.
        granted = {}
        for chunk in perms_header.split(','):
            if '=' in chunk:
                k, v = chunk.strip().split('=', 1)
                granted[k.strip().lower()] = v.strip().lower()

        contents = granted.get('contents')
        if contents and contents != 'write':
            app_settings_url = (
                f"https://github.com/{owner}/../settings/installations"
                if owner else "https://github.com/settings/installations"
            )
            return (
                "Preflight check: the CodeBuster GitHub App installation currently "
                f"grants `contents: {contents}`, but `contents: write` is required "
                "to push a fix branch. Fix this in two steps:\n"
                "  1) App developer: Developer settings → GitHub Apps → CodeBuster → "
                "Permissions → set Contents = Read & write → Save.\n"
                "  2) Repo owner: Settings → Applications → Installed GitHub Apps → "
                "CodeBuster → Configure → Review and accept the updated permissions.\n"
                f"Open: {app_settings_url}"
            )
        return None

    @staticmethod
    def _format_gh_error(prefix: str, response: Any, context_branch: Optional[str] = None) -> str:
        """Turn a failed GitHub API response into a user-readable error string."""
        status = getattr(response, 'status_code', '?')
        try:
            body = response.json() if hasattr(response, 'json') else {}
        except Exception:
            body = {}

        gh_message = ''
        if isinstance(body, dict):
            gh_message = body.get('message') or ''
            errors = body.get('errors')
            if isinstance(errors, list) and errors:
                extras = []
                for err in errors:
                    if isinstance(err, dict):
                        extras.append(err.get('message') or err.get('code') or str(err))
                    else:
                        extras.append(str(err))
                if extras:
                    gh_message = f"{gh_message} ({'; '.join(extras)})" if gh_message else '; '.join(extras)

        # Friendly guidance for the most common failure modes.
        hint = ''
        low = (gh_message or '').lower()
        if status == 403 or 'resource not accessible by integration' in low:
            hint = (
                " — the GitHub App installation is missing the `Contents: write` "
                "permission. Re-install or update the App permissions and try again."
            )
        elif status == 404:
            hint = (
                " — the repository, branch, or file was not found. Check that the "
                "App is installed on this repo and has access to it."
            )
        elif status == 422 and 'already exists' in low and context_branch:
            hint = f" — branch `{context_branch}` already exists; retry will pick a new name."
        elif status == 409:
            hint = " — the file was modified since CodeBuster read it; retry to pick up the latest."

        parts = [f"{prefix} ({status})"]
        if gh_message:
            parts.append(gh_message)
        return ': '.join(parts) + hint

    def _apply_code_fix(self, full_content: str, original: str, replacement: str) -> str:
        """Replace original snippet with replacement."""
        if not original or original not in full_content:
            return full_content
        return full_content.replace(original, replacement)

    def _apply_line_fix(self, full_content: str, line_number: int, replacement: str) -> str:
        """Replace specific line with replacement."""
        if not line_number:
            return full_content

        lines = full_content.splitlines(keepends=True)
        if 1 <= line_number <= len(lines):
            # Maintain indentation if possible
            original_line = lines[line_number - 1]
            indent = original_line[:len(original_line) - len(original_line.lstrip())]
            lines[line_number - 1] = indent + replacement + '\n'
            return "".join(lines)
        return full_content

    @staticmethod
    def _is_meaningful_code_fix(text: str, file_path: str) -> bool:
        """
        Return True if `text` looks like real code that can replace a buggy
        line. Return False when it's just comments, TODOs, or empty — which
        is the case for many deterministic analyzers' fallback "code" fields
        (e.g. '# Move to environment variable', '# Replace with: os.getenv...').

        The historical behavior was to apply those literally, which deleted
        the user's bug line and replaced it with a comment — a worse state
        than the bug itself. This guard prevents that.
        """
        if not text or not text.strip():
            return False

        # Identify per-language comment markers. Default to // for unknown.
        ext = os.path.splitext(file_path or '')[1].lower()
        lang_info = _LANG_MAP.get(ext)
        comment_prefix = lang_info[1] if lang_info else '//'
        # Cover the common single-line markers regardless of file type — many
        # analyzers emit '#' comments even for non-Python files.
        single_line_markers = ('#', '//', '--', ';;')

        # Strip line-by-line: drop blank lines and lines that are pure comments.
        meaningful_lines = []
        in_block_comment = False
        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            # Block-comment state machine for /* ... */ and """ ... """.
            if in_block_comment:
                if '*/' in line or '"""' in line or "'''" in line:
                    in_block_comment = False
                continue
            if line.startswith('/*'):
                if '*/' not in line:
                    in_block_comment = True
                continue
            if line.startswith(('"""', "'''")):
                # Could be a docstring opener or a one-liner. Treat as comment.
                if line.count('"""') == 1 and line.count("'''") == 1:
                    in_block_comment = True
                continue
            # Single-line comment markers
            if line.startswith(single_line_markers):
                continue
            if comment_prefix and line.startswith(comment_prefix):
                continue
            meaningful_lines.append(line)

        return len(meaningful_lines) > 0

    # --- Secret-leak redaction -------------------------------------------------

    @staticmethod
    def _language_info(file_path: str) -> Tuple[str, str, Optional[str]]:
        """Return (language, comment_prefix, env_template) for a file path."""
        ext = os.path.splitext(file_path or '')[1].lower()
        if ext in _LANG_MAP:
            return _LANG_MAP[ext]
        # Unknown language — generic comment prefix so we never inject '#' into Dart/JS.
        return ('unknown', '//', None)

    @staticmethod
    def _env_var_name(issue_title: str, file_path: str) -> str:
        """Derive a plausible env-var name from the issue title or file path."""
        title = (issue_title or '').lower()
        stem = os.path.splitext(os.path.basename(file_path or ''))[0].upper()

        if 'firebase' in title or 'firebase' in (file_path or '').lower():
            if 'api key' in title:
                return 'FIREBASE_API_KEY'
            return f'FIREBASE_{stem}'.rstrip('_')
        if 'aws' in title:
            return 'AWS_SECRET_ACCESS_KEY' if 'secret' in title else 'AWS_ACCESS_KEY_ID'
        if 'github' in title and 'token' in title:
            return 'GITHUB_TOKEN'
        if 'slack' in title:
            return 'SLACK_TOKEN'
        if 'stripe' in title:
            return 'STRIPE_API_KEY'
        if 'jwt' in title or 'bearer' in title:
            return 'AUTH_TOKEN'
        if 'password' in title:
            return 'DB_PASSWORD'
        # Fallback: convert the issue title ("Hardcoded Google API Key") to a var name.
        cleaned = re.sub(r'[^A-Za-z0-9]+', '_', title).strip('_').upper()
        cleaned = cleaned.replace('HARDCODED_', '') or 'SECRET_VALUE'
        return cleaned

    def _redact_secret(
        self,
        full_content: str,
        file_path: str,
        line_number: Optional[int],
        issue_title: str,
    ) -> Tuple[str, str]:
        """
        Replace the literal secret on the given line with a language-appropriate
        env lookup. Returns (new_content, summary_message). If the secret cannot
        be located, returns (unchanged_content, '').
        """
        if not line_number:
            return full_content, ''

        lines = full_content.splitlines(keepends=True)
        if not (1 <= line_number <= len(lines)):
            return full_content, ''

        language, comment, env_template = self._language_info(file_path)
        var_name = self._env_var_name(issue_title, file_path)

        original_line = lines[line_number - 1]
        # Locate the first string literal on the line ("..." or '...').
        literal_match = re.search(r"""(['"])((?:\\.|(?!\1).)*)\1""", original_line)
        if not literal_match:
            return full_content, ''

        # If the template is unknown, fall back to a placeholder literal + TODO.
        if env_template:
            replacement_expr = env_template.format(var=var_name)
        else:
            quote = literal_match.group(1)
            replacement_expr = f'{quote}REPLACE_WITH_ENV_{var_name}{quote}'

        before = original_line[:literal_match.start()]
        after = original_line[literal_match.end():]

        # Preserve existing line-ending whitespace (\n, \r\n).
        trailing = ''
        stripped_after = after.rstrip('\r\n')
        if len(stripped_after) < len(after):
            trailing = after[len(stripped_after):]
            after = stripped_after

        new_line = (
            f"{before}{replacement_expr}{after}"
            f"  {comment} CodeBuster: redacted hardcoded secret — set {var_name} in env"
            f"{trailing}"
        )
        lines[line_number - 1] = new_line

        summary = (
            f"Redacted hardcoded secret at {file_path}:{line_number}. "
            f"The value must now be supplied via the `{var_name}` environment variable. "
            f"IMPORTANT: rotate the original secret — it was exposed in git history."
        )
        return "".join(lines), summary
