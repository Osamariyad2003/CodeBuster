"""
CodeReviewer analyzer – Microsoft CodeBERT CodeReviewer integration.

Uses the pre-trained model from https://github.com/microsoft/CodeBERT/tree/master/CodeReviewer
(Hugging Face: microsoft/codereviewer) for comment generation on code diffs.

Requires: pip install torch transformers (optional; install via requirements-codereviewer.txt or extra).
Set CODEREVIEWER_ENABLED=1 to enable. When diff_context is provided (or synthesized from files),
generates review comments and returns them as findings for the orchestrator.
"""
import os
import re
from typing import List, Dict, Any, Optional

# Lazy imports to avoid hard dependency on torch/transformers
_model = None
_tokenizer = None
_config = None


def _load_model():
    """Load CodeReviewer model and tokenizer once (lazy)."""
    global _model, _tokenizer, _config
    if _model is not None:
        return _model, _tokenizer, _config
    if not os.getenv("CODEREVIEWER_ENABLED", "").strip().lower() in ("1", "true", "yes"):
        return None, None, None
    try:
        import torch
        from transformers import T5ForConditionalGeneration, RobertaTokenizer
    except ImportError:
        return None, None, None
    try:
        model_name = os.getenv("CODEREVIEWER_MODEL", "microsoft/codereviewer")
        _tokenizer = RobertaTokenizer.from_pretrained(model_name)
        _model = T5ForConditionalGeneration.from_pretrained(model_name)
        _config = _model.config
        _model.eval()
        if torch.cuda.is_available():
            _model = _model.cuda()
        return _model, _tokenizer, _config
    except Exception:
        return None, None, None


def _get_special_ids(tokenizer, config) -> Dict[str, int]:
    """Resolve CodeReviewer special token IDs from config (microsoft/codereviewer)."""
    pad_id = getattr(tokenizer, "pad_token_id", None)
    if pad_id is None and config is not None:
        pad_id = getattr(config, "pad_token_id", 0)
    pad_id = pad_id or 0
    bos_id = getattr(tokenizer, "bos_token_id", None) or (getattr(config, "bos_token_id", None) or 1)
    eos_id = getattr(tokenizer, "eos_token_id", None) or (getattr(config, "eos_token_id", None) or 2)
    add_id = getattr(config, "add_token_id", 32101) if config else 32101
    del_id = getattr(config, "del_token_id", 32102) if config else 32102
    keep_id = getattr(config, "keep_token_id", 32100) if config else 32100
    start_id = getattr(config, "start_token_id", 32103) if config else 32103
    end_id = getattr(config, "end_token_id", 32104) if config else 32104
    # msg token: decoder start for comment generation (from config lang_id or first additional)
    msg_id = None
    if config and hasattr(config, "lang_id") and isinstance(config.lang_id, dict):
        vals = list(config.lang_id.values())
        msg_id = vals[0] if vals else None
    if msg_id is None:
        msg_id = getattr(config, "decoder_start_token_id", None) or pad_id
    return {
        "pad_id": pad_id, "bos_id": bos_id, "eos_id": eos_id,
        "add_id": add_id, "del_id": del_id, "keep_id": keep_id,
        "start_id": start_id, "end_id": end_id, "msg_id": msg_id,
    }


def _diff_to_source_ids(tokenizer, config, diff_text: str, max_source_length: int = 512):
    """
    Convert a unified diff string into encoder input IDs in CodeReviewer format.
    Format: per-line prefix token (del/add/keep) + line content, with start/end tokens.
    """
    ids = _get_special_ids(tokenizer, config)
    pad_id = ids["pad_id"]
    bos_id = ids["bos_id"]
    eos_id = ids["eos_id"]
    add_id = ids["add_id"]
    del_id = ids["del_id"]
    keep_id = ids["keep_id"]
    start_id = ids["start_id"]
    end_id = ids["end_id"]
    msg_id = ids["msg_id"]

    lines = diff_text.strip().split("\n")
    # Skip @@ header line for content; keep structure
    parts = [bos_id, start_id]
    for line in lines:
        if not line.strip():
            continue
        if line.startswith("-"):
            prefix_id = del_id
            line = line[1:].strip()
        elif line.startswith("+"):
            prefix_id = add_id
            line = line[1:].strip()
        else:
            prefix_id = keep_id
            if line.startswith(" "):
                line = line[1:].strip()
        if not line:
            continue
        try:
            # RobertaTokenizer: encode returns list; often [0, ...ids..., 2] for BOS/EOS
            enc = tokenizer.encode(line, add_special_tokens=True, max_length=64, truncation=True)
            if enc and enc[0] == bos_id:
                enc = enc[1:]
            if enc and enc[-1] == eos_id:
                enc = enc[:-1]
            parts.append(prefix_id)
            parts.extend(enc)
        except Exception:
            parts.append(prefix_id)
        if len(parts) >= max_source_length - 2:
            break
    parts.append(end_id)
    parts.append(eos_id)
    if len(parts) > max_source_length:
        parts = parts[:max_source_length]
    pad_len = max_source_length - len(parts)
    parts = parts + [pad_id] * pad_len
    return parts, msg_id


def _generate_comment_for_diff(diff_text: str, file_path: str = "") -> Optional[str]:
    """Run CodeReviewer comment generation for one diff. Returns comment text or None."""
    model, tokenizer, config = _load_model()
    if model is None or tokenizer is None:
        return None
    try:
        import torch
        source_ids, decoder_start_id = _diff_to_source_ids(tokenizer, config, diff_text)
        src = torch.tensor([source_ids], dtype=torch.long)
        if torch.cuda.is_available():
            src = src.cuda()
        with torch.no_grad():
            out = model.generate(
                src,
                decoder_start_token_id=decoder_start_id,
                max_length=128,
                num_beams=4,
                early_stopping=True,
                pad_token_id=tokenizer.pad_token_id or 0,
            )
        if out is None or out.size(1) == 0:
            return None
        pred = tokenizer.decode(out[0], skip_special_tokens=True, clean_up_tokenization_spaces=True)
        return pred.strip() or None
    except Exception:
        return None


def _synthesize_diff_from_files(files: List[Dict[str, Any]]) -> List[tuple]:
    """
    When no real diff is available, synthesize a minimal diff per file (treat as all-new).
    Returns list of (file_path, diff_text).
    """
    out = []
    for f in files:
        path = f.get("path", f.get("filename", "unknown"))
        content = f.get("content", "") or ""
        lines = content.split("\n")
        diff_lines = ["@@ -0,0 +1,%d @@" % max(1, len(lines))]
        for line in lines:
            diff_lines.append("+ " + line)
        out.append((path, "\n".join(diff_lines)))
    return out


def analyze(
    files: List[Dict[str, Any]],
    diff_context: str = "",
    repository_context: Optional[Dict] = None,
) -> List[Dict[str, Any]]:
    """
    Run CodeReviewer comment generation on diffs.

    - If diff_context is provided, it is split by @@ hunks and each hunk is sent to the model.
    - If diff_context is empty and CODEREVIEWER_ENABLED=1, a synthetic diff (all lines as added)
      is built per file and the model suggests review comments.

    Returns list of findings in the same shape as other analyzers: tool=CodeReviewer, title, description, etc.
    """
    if not os.getenv("CODEREVIEWER_ENABLED", "").strip().lower() in ("1", "true", "yes"):
        return []
    model, tokenizer, _ = _load_model()
    if model is None:
        return []

    findings = []
    if diff_context and diff_context.strip():
        # Split by diff hunks (@@ -x,y +a,b @@)
        hunk_pat = re.compile(r"(@@[^@]+@@\n(?:[^\n].*\n)*)", re.MULTILINE)
        hunks = hunk_pat.findall(diff_context)
        if not hunks:
            hunks = [diff_context]
        file_from_diff = _infer_file_from_diff(diff_context)
        for hunk in hunks[:10]:  # limit to avoid timeout
            comment = _generate_comment_for_diff(hunk, file_from_diff)
            if comment:
                findings.append({
                    "tool": "CodeReviewer",
                    "module": "code_review",
                    "title": "CodeReviewer suggestion",
                    "description": comment,
                    "severity": "minor",
                    "category": "code_review",
                    "file": file_from_diff or "unknown",
                    "confidence": 0.7,
                    "evidence": [comment],
                })
    else:
        # Synthetic diff per file
        for file_path, diff_text in _synthesize_diff_from_files(files)[:20]:
            comment = _generate_comment_for_diff(diff_text, file_path)
            if comment:
                findings.append({
                    "tool": "CodeReviewer",
                    "module": "code_review",
                    "title": "CodeReviewer suggestion",
                    "description": comment,
                    "severity": "minor",
                    "category": "code_review",
                    "file": file_path,
                    "confidence": 0.6,
                    "evidence": [comment],
                })
    return findings


def _infer_file_from_diff(diff_text: str) -> str:
    """Try to infer file path from diff (e.g. --- a/path or +++ b/path)."""
    for line in diff_text.split("\n")[:5]:
        if line.startswith("--- ") or line.startswith("+++ "):
            p = line[4:].strip()
            if p.startswith("a/") or p.startswith("b/"):
                p = p[2:]
            if p and p != "/dev/null":
                return p
    return ""
