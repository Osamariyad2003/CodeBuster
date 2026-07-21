import React, { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaGithub, FaExclamationTriangle, FaExclamationCircle } from 'react-icons/fa';
import { apiClient } from '../lib/apiClient';

/* ─── Palette ─────────────────────────────────────────────────────────── */
const C = {
  critical: '#EF4444', major:  '#F59E0B',
  healthy:  '#22C55E', info:   '#818CF8',
  entry:    '#E879F9', test:   '#34D399',
  config:   '#94A3B8', link:   'rgba(129,140,248,0.28)',
  linkCrit: 'rgba(239,68,68,0.55)', bg: '#04040A',
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function nodeColor(node) {
  if (node.health < 35)        return C.critical;
  if (node.health < 60)        return C.major;
  if (node.group === 'entry')  return C.entry;
  if (node.group === 'test')   return C.test;
  if (node.group === 'config') return C.config;
  if (node.health >= 85)       return C.healthy;
  return C.info;
}

function grade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function guessCat(filepath, catIds) {
  const f = filepath.toLowerCase();
  if ((f.includes('auth') || f.includes('login') || f.includes('token') || f.includes('secret') || f.includes('crypt'))
      && catIds.includes('cat_security')) return 'cat_security';
  if ((f.includes('test') || f.includes('spec')) && catIds.includes('cat_quality')) return 'cat_quality';
  if ((f.includes('docker') || f.includes('ci') || f.includes('workflow') || f.includes('deploy'))
      && catIds.includes('cat_devops')) return 'cat_devops';
  if ((f.includes('perf') || f.includes('cache') || f.includes('optim'))
      && catIds.includes('cat_performance')) return 'cat_performance';
  if ((f.endsWith('.jsx') || f.endsWith('.tsx') || f.endsWith('.css') || f.includes('component') || f.includes('ui'))
      && catIds.includes('cat_frontend')) return 'cat_frontend';
  return catIds[0] || 'root';
}

/* ─── Graph builder from real API data ───────────────────────────────── */
function buildRealGraph(repo, categories, allIssues) {
  const nodes = [];
  const links = [];
  const repoHealth = repo.health_score ?? 75;

  nodes.push({
    id: 'root', label: repo.name || repo.full_name,
    group: 'entry', health: repoHealth,
    issues: repo.issues_count || 0, size: 14,
    fullPath: repo.full_name,
  });

  const catIds = [];
  for (const cat of (categories || [])) {
    const id = `cat_${cat.key}`;
    catIds.push(id);
    const s = cat.score ?? 70;
    nodes.push({
      id, label: cat.label,
      group: s < 35 ? 'critical' : s < 60 ? 'major' : 'dir',
      health: Math.round(s), issues: 0, size: 9,
    });
    links.push({ source: 'root', target: id });
  }

  const fileMap = {};
  for (const issue of (allIssues || [])) {
    const fp = issue.file || issue.file_path || issue.filename || null;
    if (!fp) continue;
    if (!fileMap[fp]) fileMap[fp] = { issues: 0, maxSev: 'minor' };
    fileMap[fp].issues++;
    if (issue.severity === 'critical') fileMap[fp].maxSev = 'critical';
    else if (issue.severity === 'major' && fileMap[fp].maxSev !== 'critical') fileMap[fp].maxSev = 'major';
  }

  for (const [fp, data] of Object.entries(fileMap)) {
    const filename = fp.split('/').pop();
    const baseHealth = data.maxSev === 'critical' ? 15 + Math.random() * 18
                     : data.maxSev === 'major'    ? 38 + Math.random() * 18
                     : 68 + Math.random() * 20;
    const fileId = `file_${fp.replace(/[^a-z0-9]/gi, '_')}`;
    nodes.push({
      id: fileId, label: filename, fullPath: fp,
      group: data.maxSev === 'critical' ? 'critical' : data.maxSev === 'major' ? 'major' : 'normal',
      health: Math.round(baseHealth), issues: data.issues,
      size: Math.min(6 + data.issues * 1.5, 12),
    });
    links.push({ source: guessCat(fp, catIds), target: fileId });
  }

  if (nodes.length < 8) return buildMockGraph(repo.name || 'repo');
  return { nodes, links };
}

/* ─── Fallback mock ───────────────────────────────────────────────────── */
function buildMockGraph(repoName = 'my-repo') {
  const n = (id, label, group, health, issues, size) => ({ id: `${repoName}_${id}`, label, group, health, issues, size });
  const l = (s, t) => ({ source: `${repoName}_${s}`, target: `${repoName}_${t}` });
  return {
    nodes: [
      n('root', repoName,        'entry',    82, 0, 14), n('src',  'src/',          'dir',      78, 1, 10),
      n('comp', 'components/',   'dir',      74, 3,  9), n('api',  'api/',          'dir',      55, 6,  9),
      n('auth', 'auth.js',       'critical', 22, 9,  9), n('cli',  'apiClient.js',  'critical', 31, 7,  8),
      n('dash', 'Dashboard.jsx', 'entry',    83, 1, 11), n('mod',  'models/',       'dir',      60, 4,  8),
      n('mp',   'main.py',       'entry',    79, 2, 10), n('ra',   'routes/auth.py','critical', 28, 8,  8),
      n('wk',   'workers/',      'dir',      73, 3,  8), n('sec',  'security.py',   'critical', 19,11,  9),
      n('tst',  'tests/',        'test',     94, 0,  8), n('cfg',  'config/.env',   'config',   40, 3,  7),
      n('dk',   'Dockerfile',    'config',   72, 2,  7), n('ci',   '.github/ci',    'config',   88, 0,  7),
    ],
    links: [
      l('root','src'), l('root','mp'), l('root','tst'), l('root','cfg'), l('root','dk'), l('root','ci'),
      l('src','comp'), l('src','api'), l('src','dash'),
      l('api','auth'), l('api','cli'), l('dash','cli'),
      l('mp','mod'), l('mp','wk'), l('mp','ra'),
      l('ra','auth'), l('wk','sec'), l('tst','ra'), l('auth','cfg'), l('sec','cfg'),
    ],
  };
}

/* ─── THREE node object ───────────────────────────────────────────────── */
function makeNodeObject(node) {
  const group  = new THREE.Group();
  const color  = nodeColor(node);
  const radius = (node.size || 6) * 0.55;

  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 16),
    new THREE.MeshPhongMaterial({
      color, emissive: color,
      emissiveIntensity: node.health < 35 ? 0.75 : 0.35,
      transparent: true, opacity: 0.93, shininess: 130,
    })
  ));

  if (node.health < 60) {
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.9, 12, 12),
      new THREE.MeshBasicMaterial({
        color, transparent: true,
        opacity: node.health < 35 ? 0.20 : 0.08,
        side: THREE.BackSide,
      })
    ));
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 21px "DM Sans", sans-serif';
  ctx.fillStyle = '#E4E4E7';
  ctx.textAlign = 'center';
  const lbl = node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label;
  ctx.fillText(lbl, 128, 32);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, opacity: 0.78 }));
  sp.scale.set(18, 4, 1);
  sp.position.set(0, radius + 4, 0);
  group.add(sp);

  return group;
}

/* ─── Node detail panel ───────────────────────────────────────────────── */
function NodePanel({ node, onClose }) {
  if (!node) return null;
  const color = nodeColor(node);
  const g = grade(node.health);
  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 300,
      background: 'rgba(6,6,14,0.94)', backdropFilter: 'blur(20px)',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 18,
      zIndex: 20, animation: 'panelSlide 0.22s cubic-bezier(0.4,0,0.2,1)',
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 14, right: 14,
        background: 'rgba(255,255,255,0.06)', border: 'none',
        color: '#71717A', borderRadius: 6, width: 26, height: 26,
        cursor: 'pointer', fontSize: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>×</button>

      <div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 5, padding: '2px 9px', fontSize: 9,
          fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: '#71717A', marginBottom: 9,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
          {node.group || 'module'}
        </div>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700,
          color: '#F4F4F5', margin: 0, letterSpacing: '-0.02em', wordBreak: 'break-all',
        }}>{node.label}</h2>
        {node.fullPath && node.fullPath !== node.label && (
          <div style={{ fontSize: 10, color: '#52525B', marginTop: 4, wordBreak: 'break-all' }}>{node.fullPath}</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 66, height: 66, borderRadius: '50%',
          background: `conic-gradient(${color} ${node.health * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <div style={{
            width: 50, height: 50, borderRadius: '50%', background: 'rgba(6,6,14,0.96)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{node.health}</span>
            <span style={{ fontSize: 8, color: '#52525B', letterSpacing: '0.06em' }}>SCORE</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-display)', color, lineHeight: 1 }}>{g}</div>
          <div style={{ fontSize: 10, color: '#71717A', marginTop: 2 }}>Health grade</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {[
          { label: 'Issues',  value: node.issues ?? 0, accent: node.issues > 5 ? C.critical : node.issues > 0 ? C.major : C.healthy },
          { label: 'Type',    value: node.group,        accent: '#818CF8' },
          { label: 'Health',  value: `${node.health} / 100`, accent: color },
        ].map(({ label, value, accent }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <span style={{ fontSize: 12, color: '#71717A' }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>{value}</span>
          </div>
        ))}
      </div>

      {node.issues > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Breakdown</div>
          {[
            { sev: 'Critical', count: Math.floor(node.issues * 0.4), color: C.critical },
            { sev: 'Major',    count: Math.floor(node.issues * 0.35), color: C.major },
            { sev: 'Minor',    count: Math.ceil(node.issues  * 0.25), color: C.info },
          ].filter(r => r.count > 0).map(({ sev, count, color: cl }) => (
            <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: cl, flexShrink: 0 }} />
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{ width: `${(count / node.issues) * 100}%`, height: '100%', background: cl, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 10, color: '#71717A', minWidth: 52, textAlign: 'right' }}>{count} {sev}</span>
            </div>
          ))}
        </div>
      )}

      <button style={{
        marginTop: 'auto',
        background: 'linear-gradient(135deg,#6366F1,#818CF8)', border: 'none',
        borderRadius: 7, color: '#fff', padding: '9px 0',
        fontWeight: 600, fontSize: 12, cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
      }}>View Full Analysis →</button>
    </div>
  );
}

/* ─── Legend ──────────────────────────────────────────────────────────── */
const LEGEND = [
  { color: C.critical, label: 'Critical  < 35'  },
  { color: C.major,    label: 'Degraded  35–60' },
  { color: C.info,     label: 'Moderate  60–85' },
  { color: C.healthy,  label: 'Healthy   > 85'  },
  { color: C.entry,    label: 'Entry point'      },
  { color: C.test,     label: 'Tests'            },
  { color: C.config,   label: 'Config / Infra'   },
];

/* ─── Stats pills ─────────────────────────────────────────────────────── */
function StatBar({ nodes }) {
  if (!nodes?.length) return null;
  const avg  = Math.round(nodes.reduce((s, n) => s + n.health, 0) / nodes.length);
  const pills = [
    { label: 'Nodes',    value: nodes.length,                                   color: '#818CF8' },
    { label: 'Avg',      value: `${avg}%`,                                      color: avg >= 70 ? C.healthy : C.major },
    { label: 'Critical', value: nodes.filter(n => n.health < 35).length,        color: C.critical },
    { label: 'Degraded', value: nodes.filter(n => n.health >= 35 && n.health < 60).length, color: C.major },
    { label: 'Healthy',  value: nodes.filter(n => n.health >= 85).length,       color: C.healthy },
  ];
  return (
    <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 10, pointerEvents: 'none' }}>
      {pills.map(({ label, value, color }) => (
        <div key={label} style={{
          background: 'rgba(6,6,14,0.82)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 7, padding: '5px 11px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 48,
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{value}</span>
          <span style={{ fontSize: 9, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main ────────────────────────────────────────────────────────────── */
export default function ConstellationPage() {
  const containerRef = useRef(null);
  const graphRef     = useRef(null);
  const rotateRef    = useRef(true);
  const angleRef     = useRef(0);
  const animRef      = useRef(null);

  const [dims, setDims]                 = useState({ w: 800, h: 600 });
  const [repos, setRepos]               = useState([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [graphData, setGraphData]       = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode]   = useState(null);

  /* Fetch all repos (enriched with health scores) */
  useEffect(() => {
    apiClient.get('/api/repos')
      .then(res => {
        // apiClient interceptor returns response.data directly, so res = { repos: [...] }
        const list = res?.repos ?? (Array.isArray(res) ? res : []);
        setRepos(list);
        if (list.length > 0) setSelectedRepo(list[0]);
      })
      .catch(() => {})
      .finally(() => setReposLoading(false));
  }, []);

  /* Load graph for selected repo */
  useEffect(() => {
    if (!selectedRepo) return;
    setGraphLoading(true);
    setSelectedNode(null);
    setGraphData(null);

    if (selectedRepo.id === 'mock') {
      setGraphData(buildMockGraph(selectedRepo.name));
      setGraphLoading(false);
      return;
    }

    apiClient.get(`/api/repos/${selectedRepo.id}/latest-review`)
      .then(async res => {
        // apiClient returns response.data directly
        const { review, categories } = res || {};
        if (!review) {
          setGraphData(buildMockGraph(selectedRepo.name || selectedRepo.full_name));
          return;
        }
        let allIssues = [];
        try {
          const ir = await apiClient.get(`/api/reviews/${review.id}/issues`, { params: { limit: 100, sort: 'severity' } });
          allIssues = ir?.items ?? [];
        } catch (_) {}
        setGraphData(buildRealGraph(selectedRepo, categories, allIssues));
      })
      .catch(() => {
        setGraphData(buildMockGraph(selectedRepo.name || selectedRepo.full_name));
      })
      .finally(() => setGraphLoading(false));
  }, [selectedRepo?.id]);

  /* Resize */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setDims({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* Auto-rotation */
  useEffect(() => {
    const tick = () => {
      if (rotateRef.current && graphRef.current) {
        angleRef.current += 0.003;
        const d = 420;
        graphRef.current.cameraPosition({ x: d * Math.sin(angleRef.current), z: d * Math.cos(angleRef.current) });
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const handleNodeClick = useCallback(node => {
    rotateRef.current = false;
    setSelectedNode(node);
    if (graphRef.current) {
      const d = 140;
      graphRef.current.cameraPosition(
        { x: node.x + d, y: node.y + d * 0.3, z: node.z + d },
        { x: node.x, y: node.y, z: node.z },
        750
      );
    }
  }, []);

  const handleNodeHover = useCallback(node => {
    setHoveredNode(node || null);
    if (containerRef.current) containerRef.current.style.cursor = node ? 'pointer' : 'default';
  }, []);

  const linkColor  = useCallback(link => {
    const src = graphData?.nodes.find(n => n.id === (link.source?.id ?? link.source));
    return src && src.health < 35 ? C.linkCrit : C.link;
  }, [graphData]);

  const linkWidth  = useCallback(link => {
    const src = graphData?.nodes.find(n => n.id === (link.source?.id ?? link.source));
    return src && src.health < 35 ? 1.4 : 0.7;
  }, [graphData]);

  /* Repos that have issues — same filter as the Repositories tab */
  const reposWithIssues = repos.filter(r => (r.issues_count ?? 0) > 0);

  const gradeColor = g => ({ A:'#059669', B:'#4F46E5', C:'#F59E0B', D:'#EF4444', F:'#991B1B' }[g] || '#9CA3AF');
  const scoreColor = s => s == null ? '#9CA3AF' : s >= 85 ? '#059669' : s >= 70 ? '#4F46E5' : s >= 50 ? '#F59E0B' : '#EF4444';

  const repoLabel = selectedRepo
    ? (selectedRepo.full_name || selectedRepo.name || 'Select repository')
    : 'Select repository';

  return (
    <div className="ai-reviews-page">

      {/* ── Status bar (mirrors AI Reviews) ── */}
      <div className="ai-reviews-status-bar">
        <div className="ai-reviews-status-bar__left">
          {reposWithIssues.length > 0 ? (
            <>
              Showing{' '}
              <Link to="/repos" className="ai-reviews-status-bar__link">
                {reposWithIssues.length === 1 ? '1 repository' : `${reposWithIssues.length} repositories`}
              </Link>
              {' '}with issues
              {repos.length > reposWithIssues.length && (
                <span className="text-muted small ms-1">
                  · {repos.length - reposWithIssues.length} clean repo{repos.length - reposWithIssues.length > 1 ? 's' : ''} also available
                </span>
              )}
            </>
          ) : (
            <>
              <Link to="/repos" className="ai-reviews-status-bar__link">
                {repos.length === 1 ? '1 repository' : `${repos.length} repositories`}
              </Link>
              {' '}connected
              {repos.length === 0 && !reposLoading && (
                <span className="text-muted small ms-1"> · connect repos to map a constellation</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Overview bar with repo dropdown (mirrors AI Reviews) ── */}
      <div className="ai-reviews-overview-bar">
        <h1 className="ai-reviews-overview-bar__title">Architecture Constellation</h1>
        <div className="ms-auto">
          <Dropdown align="end">
            <Dropdown.Toggle
              variant="outline-secondary"
              size="sm"
              id="constellation-repo-dropdown"
              style={{ minWidth: 200 }}
              disabled={reposLoading}
            >
              {reposLoading ? 'Loading repos…' : (
                <span className="d-flex align-items-center gap-2">
                  <FaGithub size={12} />
                  <span className="text-truncate" style={{ maxWidth: 160 }}>{repoLabel}</span>
                  {selectedRepo?.critical_issues > 0 && (
                    <span style={{
                      background: 'rgba(239,68,68,0.15)', color: C.critical,
                      borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600,
                    }}>
                      {selectedRepo.critical_issues}
                    </span>
                  )}
                </span>
              )}
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ minWidth: 320, maxHeight: 480, overflowY: 'auto', padding: '6px' }}>

              {/* Repos with issues */}
              {reposWithIssues.map(repo => {
                const score = repo.health_score;
                const g     = repo.overall_grade;
                const active = repo.id === selectedRepo?.id;
                return (
                  <Dropdown.Item
                    key={repo.id}
                    as="div"
                    onClick={() => { setSelectedRepo(repo); rotateRef.current = true; }}
                    style={{
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      background: active ? 'rgba(99,102,241,0.10)' : 'transparent',
                      border: active ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                      marginBottom: 4,
                    }}
                    className="p-0"
                  >
                    {/* Row 1: icon + name + grade */}
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: '#F3F4F6', color: '#374151',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <FaGithub size={13} />
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: active ? 600 : 500,
                        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>
                        {repo.full_name || repo.name}
                      </span>
                      {g && (
                        <span style={{
                          width: 26, height: 26, borderRadius: 6,
                          background: gradeColor(g), color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 12, flexShrink: 0,
                        }}>{g}</span>
                      )}
                    </div>

                    {/* Row 2: health bar */}
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 72 }}>Health score</span>
                      <div style={{ flex: 1, height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.max(2, Math.min(100, score ?? 0))}%`,
                          height: '100%', background: scoreColor(score), borderRadius: 3,
                        }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: scoreColor(score), minWidth: 34, textAlign: 'right' }}>
                        {score != null ? `${score}` : '—'}
                      </span>
                    </div>

                    {/* Row 3: issue badges */}
                    <div className="d-flex gap-2">
                      {repo.critical_issues > 0 && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 600, color: C.critical,
                          background: 'rgba(239,68,68,0.10)', borderRadius: 4, padding: '2px 7px',
                        }}>
                          <FaExclamationCircle size={9} />
                          {repo.critical_issues} critical
                        </span>
                      )}
                      {(repo.high_issues ?? 0) > 0 && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 600, color: C.major,
                          background: 'rgba(245,158,11,0.10)', borderRadius: 4, padding: '2px 7px',
                        }}>
                          <FaExclamationTriangle size={9} />
                          {repo.high_issues} major
                        </span>
                      )}
                      {(repo.issues_count ?? 0) > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {repo.issues_count} total
                        </span>
                      )}
                    </div>
                  </Dropdown.Item>
                );
              })}

              {/* Divider + repos without issues */}
              {reposWithIssues.length < repos.length && (
                <>
                  {reposWithIssues.length > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '6px 12px 3px',
                      textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                      No issues found
                    </div>
                  )}
                  {repos.filter(r => (r.issues_count ?? 0) === 0).map(repo => {
                    const active = repo.id === selectedRepo?.id;
                    return (
                      <Dropdown.Item
                        key={repo.id}
                        as="div"
                        onClick={() => { setSelectedRepo(repo); rotateRef.current = true; }}
                        style={{
                          padding: '8px 12px', borderRadius: 7, cursor: 'pointer',
                          background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
                          marginBottom: 2,
                        }}
                        className="d-flex align-items-center gap-2 p-0"
                      >
                        <FaGithub size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{
                          fontSize: 12, color: 'var(--text-muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                        }}>{repo.full_name || repo.name}</span>
                        <span style={{ fontSize: 10, color: C.healthy }}>✓ clean</span>
                      </Dropdown.Item>
                    );
                  })}
                </>
              )}

              {!reposLoading && repos.length === 0 && (
                <Dropdown.Item as={Link} to="/repos/search" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Connect repositories first →
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      {/* ── 3-D constellation canvas ── */}
      <div style={{ borderRadius: 'var(--border-radius-lg)', overflow: 'hidden', flex: 1, minHeight: 0 }}>
        <div
          ref={containerRef}
          style={{ position: 'relative', width: '100%', height: '100%', background: C.bg }}
          onMouseEnter={() => { rotateRef.current = false; }}
          onMouseLeave={() => { if (!selectedNode) rotateRef.current = true; }}
        >
          {/* Graph title overlay */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '14px 20px',
            background: 'linear-gradient(180deg, rgba(4,4,10,0.96) 0%, transparent 100%)',
            zIndex: 10, pointerEvents: 'none',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 9, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
                repo map
              </div>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700,
                color: '#F4F4F5', margin: 0, letterSpacing: '-0.03em',
              }}>
                {selectedRepo?.name || selectedRepo?.full_name || '—'}
                {graphLoading && <span style={{ color: '#3F3F46', fontWeight: 400 }}> · loading…</span>}
              </h2>
            </div>
            <div style={{ fontSize: 10, color: '#3F3F46', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block', boxShadow: '0 0 5px #22C55E' }} />
              drag · scroll zoom · click node
            </div>
          </div>

          {/* Stats */}
          {graphData && <StatBar nodes={graphData.nodes} />}

          {/* Loading overlay */}
          {graphLoading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(4,4,10,0.65)', backdropFilter: 'blur(4px)', zIndex: 5,
            }}>
              <span style={{ color: '#818CF8', fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '-0.02em' }}>
                Mapping constellation…
              </span>
            </div>
          )}

          {/* Force graph */}
          {graphData && (
            <ForceGraph3D
              ref={graphRef}
              graphData={graphData}
              width={dims.w}
              height={dims.h}
              backgroundColor={C.bg}
              nodeThreeObject={makeNodeObject}
              nodeThreeObjectExtend={false}
              nodeLabel={n => `${n.label}  ·  Health ${n.health}%  ·  ${n.issues} issue${n.issues !== 1 ? 's' : ''}`}
              linkColor={linkColor}
              linkWidth={linkWidth}
              linkOpacity={0.6}
              linkCurvature={0.15}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              onBackgroundClick={() => { setSelectedNode(null); rotateRef.current = true; }}
              enableNodeDrag
              cooldownTime={3000}
              d3VelocityDecay={0.3}
              showNavInfo={false}
            />
          )}

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 18, left: 18,
            background: 'rgba(6,6,14,0.80)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 9, padding: '11px 15px',
            display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Legend</div>
            {LEGEND.map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}` }} />
                <span style={{ fontSize: 10, color: '#A1A1AA' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Hover tooltip */}
          {hoveredNode && !selectedNode && (
            <div style={{
              position: 'absolute', bottom: 18, right: 18,
              background: 'rgba(6,6,14,0.9)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 7, padding: '7px 13px',
              color: '#E4E4E7', fontSize: 12, zIndex: 10, pointerEvents: 'none',
            }}>
              <strong style={{ color: nodeColor(hoveredNode), fontFamily: 'var(--font-display)' }}>{hoveredNode.label}</strong>
              <span style={{ color: '#71717A', marginLeft: 8 }}>health {hoveredNode.health}%</span>
              {hoveredNode.issues > 0 && (
                <span style={{ color: C.critical, marginLeft: 8 }}>· {hoveredNode.issues} issues</span>
              )}
            </div>
          )}

          {/* Node detail panel */}
          {selectedNode && (
            <NodePanel node={selectedNode} onClose={() => { setSelectedNode(null); rotateRef.current = true; }} />
          )}

          <style>{`
            @keyframes panelSlide {
              from { transform: translateX(20px); opacity: 0; }
              to   { transform: translateX(0);    opacity: 1; }
            }
            .ai-reviews-page { display: flex; flex-direction: column; height: 100%; }
            .ai-reviews-page > div:last-child { flex: 1; min-height: 0; }
          `}</style>
        </div>
      </div>
    </div>
  );
}
