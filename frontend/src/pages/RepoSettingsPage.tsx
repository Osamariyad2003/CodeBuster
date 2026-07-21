import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Container, Spinner, Alert, Form, Button } from "react-bootstrap";
import { codebusterApi, RepoSettings as RepoSettingsType } from "../api/codebuster";

const ANALYZERS = ["security", "secrets", "dependencies", "quality", "dead_code", "performance", "maintainability", "devops", "frontend"];
const SEVERITIES = ["CRITICAL", "MAJOR", "MINOR", "INFO"];
const GRADES = ["A", "B", "C", "D", "F"];

function parseSettings(repoId: string, res: any): RepoSettingsType {
  const raw = res?.settings ?? res;
  const enabled = Array.isArray(raw?.enabled_analyzers)
    ? raw.enabled_analyzers
    : Array.isArray(raw?.enabled_modules)
    ? raw.enabled_modules
    : [];
  return {
    repo_id: repoId,
    enabled_analyzers: enabled,
    min_severity: raw?.min_severity ?? raw?.severity_threshold ?? SEVERITIES[0],
    fail_pr_on_grade_below: raw?.fail_pr_on_grade_below ?? GRADES[GRADES.length - 1],
  };
}

export default function RepoSettingsPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const [settings, setSettings] = useState<RepoSettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    let cancelled = false;
    codebusterApi
      .getRepoSettings(repoId)
      .then((res: any) => {
        if (cancelled) return;
        setSettings(parseSettings(repoId, res));
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || "Failed to load settings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [repoId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoId || !settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    codebusterApi
      .updateRepoSettings(repoId, {
        enabled_analyzers: settings.enabled_analyzers ?? [],
        min_severity: settings.min_severity,
        fail_pr_on_grade_below: settings.fail_pr_on_grade_below,
      })
      .then((res: any) => {
        // PUT now returns { success, settings } directly
        if (res?.settings) {
          setSettings(parseSettings(repoId!, res));
        }
        setSuccess("Settings saved successfully.");
      })
      .catch((e: any) => setError(e?.message || "Failed to save settings"))
      .finally(() => setSaving(false));
  };

  const toggleAnalyzer = (key: string) => {
    if (!settings) return;
    const list = settings.enabled_analyzers ?? [];
    const next = list.includes(key) ? list.filter((a) => a !== key) : [...list, key];
    setSettings({ ...settings, enabled_analyzers: next });
  };

  if (loading && !settings) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" /> <span>Loading settings…</span>
      </Container>
    );
  }
  if (error && !settings) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
        <Link to="/repos">Back to repos</Link>
      </Container>
    );
  }
  if (!settings) return null;

  return (
    <Container className="py-4">
      <Link to="/repos" className="d-inline-block mb-3">← Back to repos</Link>
      <h4 className="mb-4">Repository settings (policy toggles)</h4>
      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)}>{success}</Alert>}
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-4">
          <Form.Label>Enabled analyzers</Form.Label>
          <div className="d-flex flex-wrap gap-2">
            {ANALYZERS.map((key) => (
              <Form.Check
                key={key}
                type="checkbox"
                id={`analyzer-${key}`}
                label={key}
                checked={(settings.enabled_analyzers ?? []).includes(key)}
                onChange={() => toggleAnalyzer(key)}
              />
            ))}
          </div>
        </Form.Group>
        <Form.Group className="mb-4">
          <Form.Label>Minimum severity to report</Form.Label>
          <Form.Select
            value={settings.min_severity ?? SEVERITIES[0]}
            onChange={(e) => setSettings({ ...settings, min_severity: e.target.value })}
            aria-label="Min severity"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group className="mb-4">
          <Form.Label>Fail PR on grade below</Form.Label>
          <Form.Select
            value={settings.fail_pr_on_grade_below ?? GRADES[GRADES.length - 1]}
            onChange={(e) => setSettings({ ...settings, fail_pr_on_grade_below: e.target.value })}
            aria-label="Fail PR grade"
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Form.Select>
        </Form.Group>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </Form>
    </Container>
  );
}
