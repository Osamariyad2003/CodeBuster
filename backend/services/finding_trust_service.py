"""Analyzer trust scoring, derived from reviewer feedback.

Reviewers accepting or dismissing findings (`Feedback`, see
`routes/feedback.py`) is a live false-positive signal per analyzer module. This
service turns that history into a per-module confidence multiplier so a
module reviewers chronically dismiss gets down-weighted in future reviews,
instead of the "Finding Quality" page being a read-only dashboard nobody acts
on.

Design choices, deliberately conservative:
- Multipliers only kick in once a module has `MIN_SAMPLES` feedback entries;
  below that a single dismissal could otherwise crater a module's trust.
- The floor is 0.5, matching the confidence clamp already used in
  `AIReviewService._weighted_penalty` -- a distrusted analyzer's findings
  still show up and still count, just at reduced weight. We never fully
  silence an analyzer based on feedback alone.
- Multipliers are computed from a trailing window (default 90 days) so trust
  can recover if a noisy analyzer improves or gets tuned.
"""
from datetime import datetime, timedelta
from collections import defaultdict

from models import db, Feedback, Issue

MIN_SAMPLES = 5
TRUST_FLOOR = 0.5
DISMISS_ACTIONS = {'dismiss', 'ignore'}


def get_module_trust_multipliers(days: int = 90) -> dict:
    """Return {module: multiplier in [TRUST_FLOOR, 1.0]} from recent feedback.

    multiplier = 1.0 - 0.5 * dismiss_rate, so a module dismissed 100% of the
    time lands at the floor (0.5) rather than being zeroed out, and a module
    that's never dismissed stays at full trust (1.0).
    """
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.session.query(Feedback, Issue)
        .join(Issue, Feedback.issue_id == Issue.id)
        .filter(Feedback.created_at >= since)
        .all()
    )

    totals = defaultdict(lambda: {'total': 0, 'dismissed': 0})
    for f, issue in rows:
        module = issue.module or 'unknown'
        totals[module]['total'] += 1
        if f.action in DISMISS_ACTIONS:
            totals[module]['dismissed'] += 1

    multipliers = {}
    for module, v in totals.items():
        if v['total'] < MIN_SAMPLES:
            continue
        dismiss_rate = v['dismissed'] / v['total']
        multipliers[module] = max(TRUST_FLOOR, 1.0 - 0.5 * dismiss_rate)
    return multipliers


def apply_trust_adjustment(findings: list, days: int = 90) -> list:
    """Damp each finding's confidence by its module's historical trust.

    Mutates and returns `findings` (list of dicts with a 'module' key, as
    produced by the analyzers before AI reasoning). Adds `raw_confidence` and
    `trust_multiplier` so the adjustment is visible/debuggable downstream,
    and normalizes confidence to the 0-1 scale in the process (some analyzers
    write 0-100 into the same field).
    """
    multipliers = get_module_trust_multipliers(days=days)
    if not multipliers:
        return findings

    for f in findings:
        module = f.get('module') or 'unknown'
        multiplier = multipliers.get(module)
        if multiplier is None:
            continue

        raw = f.get('confidence', 0.5)
        try:
            raw = float(raw)
        except (TypeError, ValueError):
            raw = 0.5
        normalized = raw / 100.0 if raw > 1.0 else raw

        f['raw_confidence'] = normalized
        f['trust_multiplier'] = round(multiplier, 3)
        f['confidence'] = round(normalized * multiplier, 3)

    return findings
