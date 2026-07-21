# CodeReviewer (Microsoft CodeBERT) Integration

CodeBuster can optionally use [CodeReviewer](https://github.com/microsoft/CodeBERT/tree/master/CodeReviewer) from Microsoft's CodeBERT to generate review comments on code diffs. The model is pre-trained for code review tasks (quality estimation, comment generation, code refinement) as described in [CodeReviewer: Pre-Training for Automating Code Review Activities](https://arxiv.org/abs/2203.09095).

## Setup

1. **Install optional dependencies** (PyTorch + Hugging Face Transformers):

   ```bash
   cd backend
   pip install -r requirements-codereviewer.txt
   ```

2. **Enable in environment** (e.g. `.env`):

   ```env
   CODEREVIEWER_ENABLED=1
   # Optional: use a different model path (default: microsoft/codereviewer)
   # CODEREVIEWER_MODEL=microsoft/codereviewer
   ```

3. Restart the backend (and Celery worker if you run scans via the queue).

## Behavior

- **When `diff_context` is provided** (e.g. from a PR or webhook): the analyzer splits the diff into hunks and runs CodeReviewer **comment generation** on each hunk. Generated comments are emitted as findings with `tool=CodeReviewer`.
- **When no diff is available** (e.g. full-repo scan): a synthetic diff is built per file (all lines as “added”). The model may still suggest review comments for the new file content.

Findings are merged with other analyzers (security, lint, etc.) and then passed to the AI reasoning step (Gemini/OpenAI) for prioritization and summary.

## Disabling

- Set `CODEREVIEWER_ENABLED=0` (or leave unset), or
- In repo/config, set `analyzers.codereviewer: false` to disable per-repo.

## References

- [CodeReviewer on GitHub](https://github.com/microsoft/CodeBERT/tree/master/CodeReviewer)
- [CodeReviewer on Hugging Face](https://huggingface.co/microsoft/codereviewer)
- [Paper: CodeReviewer: Pre-Training for Automating Code Review Activities](https://arxiv.org/abs/2203.09095)
