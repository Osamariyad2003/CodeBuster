import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Table, Badge, Button, Form, Row, Col, Spinner, InputGroup } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from './lib/apiClient';
import ConfidenceBadge from './components/ConfidenceBadge';
import { Pagination } from './components/Pagination';
import { usePolling } from './hooks/usePolling';
import {
    FaWrench,
    FaCheckCircle,
    FaSearch,
    FaTimes,
    FaFilter,
    FaGithub,
    FaBolt,
    FaSync,
    FaLayerGroup
} from 'react-icons/fa';

const IssuesPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [repos, setRepos] = useState([]);

    // Initialize filters from URL parameters or defaults
    const [filters, setFilters] = useState({
        severity: searchParams.get('severity') || '',
        category: searchParams.get('category') || '',
        status: searchParams.get('status') || '',
        patch_status: searchParams.get('patch_status') || '',
        repo_id: searchParams.get('repo_id') || '',
        q: searchParams.get('q') || ''
    });

    const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');

    // Load available user repositories for the repository filter
    useEffect(() => {
        const fetchRepos = async () => {
            try {
                const res = await apiClient.get('/api/repos');
                const repoList = Array.isArray(res)
                    ? res
                    : Array.isArray(res?.repos)
                        ? res.repos
                        : Array.isArray(res?.data)
                            ? res.data
                            : Array.isArray(res?.data?.repos)
                                ? res.data.repos
                                : [];
                setRepos(repoList);
            } catch (err) {
                console.error('Failed to fetch repositories for filter', err);
            }
        };
        fetchRepos();
    }, []);

    // Sync state with URL search params changes (e.g. browser back/forward or external links)
    useEffect(() => {
        const paramSeverity = searchParams.get('severity') || '';
        const paramCategory = searchParams.get('category') || '';
        const paramStatus = searchParams.get('status') || '';
        const paramPatch = searchParams.get('patch_status') || '';
        const paramRepo = searchParams.get('repo_id') || '';
        const paramQ = searchParams.get('q') || '';

        setFilters(prev => ({
            ...prev,
            severity: paramSeverity,
            category: paramCategory,
            status: paramStatus,
            patch_status: paramPatch,
            repo_id: paramRepo,
            q: paramQ
        }));
        setSearchInput(paramQ);
    }, [searchParams]);

    const fetchIssues = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (filters.severity) params.append('severity', filters.severity);
            if (filters.category) params.append('category', filters.category);
            if (filters.status) params.append('status', filters.status);
            if (filters.patch_status) params.append('patch_status', filters.patch_status);
            if (filters.repo_id) params.append('repo_id', filters.repo_id);
            if (filters.q) params.append('q', filters.q);
            params.append('page', page);
            params.append('limit', 10);

            const response = await apiClient.get(`/api/issues?${params.toString()}`);
            return response;
        } catch (err) {
            console.error('Failed to fetch issues', err);
            return { issues: [], total_pages: 1, total_count: 0 };
        }
    }, [filters, page]);

    const { data: issuesData, refetch } = usePolling(fetchIssues, {
        key: `issues-${JSON.stringify(filters)}-${page}`,
        interval: 30000
    });

    useEffect(() => {
        if (issuesData) {
            setIssues(Array.isArray(issuesData.data) ? issuesData.data : []);
            setTotalPages(issuesData.total_pages || 1);
            setTotalCount(issuesData.total_count || 0);
            setLoading(false);
        }
    }, [issuesData]);

    const updateFilterParam = (key, value) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        setPage(1);
        setLoading(true);

        const newParams = new URLSearchParams(searchParams);
        if (value) {
            newParams.set(key, value);
        } else {
            newParams.delete(key);
        }
        setSearchParams(newParams);
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        updateFilterParam('q', searchInput.trim());
    };

    const clearAllFilters = () => {
        setFilters({
            severity: '',
            category: '',
            status: '',
            patch_status: '',
            repo_id: '',
            q: ''
        });
        setSearchInput('');
        setPage(1);
        setLoading(true);
        setSearchParams(new URLSearchParams());
    };

    const hasActiveFilters = useMemo(() => {
        return !!(
            filters.severity ||
            filters.category ||
            filters.status ||
            filters.patch_status ||
            filters.repo_id ||
            filters.q
        );
    }, [filters]);

    return (
        <Container className="py-4" style={{ maxWidth: 1200 }}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                <div>
                    <h1 style={{ fontWeight: 800, fontSize: '1.65rem', color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                        Issues & Code Patches
                    </h1>
                    <p className="text-muted small mb-0 mt-1">
                        Detected code vulnerabilities, AST smells, and autonomous 1-click patches
                    </p>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={refetch}
                        className="d-flex align-items-center gap-1.5"
                        style={{ borderRadius: 8 }}
                        title="Refresh findings"
                    >
                        <FaSync size={11} className={loading ? 'fa-spin' : ''} /> Refresh
                    </Button>
                    <Badge bg="secondary" className="border border-secondary-subtle py-2 px-3" style={{ fontSize: '0.8rem', borderRadius: 8 }}>
                        {totalCount} Total Issues
                    </Badge>
                </div>
            </div>

            {/* Quick Patch Readiness Filter Pills */}
            <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                <span className="text-muted small fw-semibold me-1 d-flex align-items-center gap-1">
                    <FaBolt size={12} style={{ color: '#FF570A' }} /> Patch Readiness:
                </span>
                <Button
                    size="sm"
                    variant={filters.patch_status === '' ? 'primary' : 'outline-secondary'}
                    onClick={() => updateFilterParam('patch_status', '')}
                    style={{ borderRadius: 20, fontSize: '0.8rem', padding: '4px 14px' }}
                >
                    All Issues
                </Button>
                <Button
                    size="sm"
                    variant={filters.patch_status === 'ready' ? 'primary' : 'outline-secondary'}
                    onClick={() => updateFilterParam('patch_status', 'ready')}
                    className="d-inline-flex align-items-center gap-1"
                    style={{ borderRadius: 20, fontSize: '0.8rem', padding: '4px 14px' }}
                >
                    <FaWrench size={11} /> Patch Available
                </Button>
                <Button
                    size="sm"
                    variant={filters.patch_status === 'applied' ? 'primary' : 'outline-secondary'}
                    onClick={() => updateFilterParam('patch_status', 'applied')}
                    className="d-inline-flex align-items-center gap-1"
                    style={{ borderRadius: 20, fontSize: '0.8rem', padding: '4px 14px' }}
                >
                    <FaCheckCircle size={11} /> Patch Applied
                </Button>
                <Button
                    size="sm"
                    variant={filters.patch_status === 'pending' ? 'primary' : 'outline-secondary'}
                    onClick={() => updateFilterParam('patch_status', 'pending')}
                    style={{ borderRadius: 20, fontSize: '0.8rem', padding: '4px 14px' }}
                >
                    Pending Fix
                </Button>
            </div>

            {/* Filter Bar Box */}
            <div
                className="mb-4 p-3.5"
                style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 14,
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                <Row className="g-3 align-items-end">
                    {/* Search Keyword */}
                    <Col lg={4} md={6}>
                        <Form.Label className="small fw-bold text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Keyword Search
                        </Form.Label>
                        <Form onSubmit={handleSearchSubmit}>
                            <InputGroup>
                                <InputGroup.Text style={{ background: 'var(--surface-card-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                                    <FaSearch size={13} />
                                </InputGroup.Text>
                                <Form.Control
                                    type="text"
                                    placeholder="Search by title, file, or smell..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    style={{
                                        background: 'var(--surface-card)',
                                        border: '1px solid var(--border-default)',
                                        color: 'var(--text-primary)',
                                        borderRadius: '0 8px 8px 0'
                                    }}
                                />
                            </InputGroup>
                        </Form>
                    </Col>

                    {/* Repository Selector */}
                    <Col lg={3} md={6}>
                        <Form.Label className="small fw-bold text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Repository
                        </Form.Label>
                        <Form.Select
                            name="repo_id"
                            value={filters.repo_id}
                            onChange={(e) => updateFilterParam('repo_id', e.target.value)}
                            style={{
                                background: 'var(--surface-card)',
                                border: '1px solid var(--border-default)',
                                color: 'var(--text-primary)',
                                borderRadius: 8
                            }}
                        >
                            <option value="">All Repositories</option>
                            {repos.map(r => (
                                <option key={r.id} value={r.id}>
                                    {r.name || r.full_name}
                                </option>
                            ))}
                        </Form.Select>
                    </Col>

                    {/* Severity Selector */}
                    <Col lg={2} md={4}>
                        <Form.Label className="small fw-bold text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Severity
                        </Form.Label>
                        <Form.Select
                            name="severity"
                            value={filters.severity}
                            onChange={(e) => updateFilterParam('severity', e.target.value)}
                            style={{
                                background: 'var(--surface-card)',
                                border: '1px solid var(--border-default)',
                                color: 'var(--text-primary)',
                                borderRadius: 8
                            }}
                        >
                            <option value="">All Severities</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </Form.Select>
                    </Col>

                    {/* Category Selector */}
                    <Col lg={2} md={4}>
                        <Form.Label className="small fw-bold text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Category
                        </Form.Label>
                        <Form.Select
                            name="category"
                            value={filters.category}
                            onChange={(e) => updateFilterParam('category', e.target.value)}
                            style={{
                                background: 'var(--surface-card)',
                                border: '1px solid var(--border-default)',
                                color: 'var(--text-primary)',
                                borderRadius: 8
                            }}
                        >
                            <option value="">All Categories</option>
                            <option value="Security">Security</option>
                            <option value="Quality">Quality</option>
                            <option value="Performance">Performance</option>
                            <option value="Maintainability">Maintainability</option>
                        </Form.Select>
                    </Col>

                    {/* Action button */}
                    <Col lg={1} md={4}>
                        {hasActiveFilters ? (
                            <Button
                                variant="outline-danger"
                                className="w-100 d-flex align-items-center justify-content-center gap-1"
                                onClick={clearAllFilters}
                                style={{ borderRadius: 8, fontWeight: 600 }}
                                title="Reset all filters"
                            >
                                <FaTimes size={12} /> Clear
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                className="w-100 d-flex align-items-center justify-content-center gap-1"
                                onClick={handleSearchSubmit}
                                style={{ borderRadius: 8, fontWeight: 600 }}
                            >
                                Filter
                            </Button>
                        )}
                    </Col>
                </Row>
            </div>

            {/* Findings Table Card */}
            <div
                style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                <Table hover responsive className="mb-0 align-middle">
                    <thead style={{ background: 'var(--surface-card-elevated)' }}>
                        <tr>
                            <th className="py-3 ps-4 border-0 text-muted small">SEVERITY</th>
                            <th className="py-3 border-0 text-muted small">TITLE / REPOSITORY</th>
                            <th className="py-3 border-0 text-muted small">CATEGORY</th>
                            <th className="py-3 border-0 text-muted small">PATCH STATUS</th>
                            <th className="py-3 border-0 text-muted small">CONFIDENCE</th>
                            <th className="py-3 text-end pe-4 border-0">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="text-center py-5">
                                    <Spinner animation="border" size="sm" style={{ color: '#FF570A' }} />
                                    <span className="ms-2 text-muted small">Loading findings & patches…</span>
                                </td>
                            </tr>
                        ) : issues.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-5 text-muted">
                                    <div className="py-3">
                                        <FaFilter size={24} className="mb-2 opacity-50" />
                                        <p className="mb-1 fw-semibold">No issues match the selected filters.</p>
                                        <p className="small mb-3 text-muted">Try clearing some filters or searching for different keywords.</p>
                                        {hasActiveFilters && (
                                            <Button variant="outline-primary" size="sm" onClick={clearAllFilters} style={{ borderRadius: 8 }}>
                                                Reset Filters
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            issues.map(issue => (
                                <tr
                                    key={issue.id}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/issues/${issue.id}`)}
                                >
                                    <td className="ps-4">
                                        <Badge bg={issue.severity === 'critical' || issue.severity === 'high' ? 'danger' : issue.severity === 'medium' ? 'warning' : 'secondary'}>
                                            {issue.severity}
                                        </Badge>
                                    </td>
                                    <td style={{ maxWidth: 360 }} className="text-truncate">
                                        <span className="fw-bold d-block text-truncate" style={{ color: 'var(--text-primary)' }}>
                                            {issue.title || issue.message}
                                        </span>
                                        <div className="d-flex align-items-center gap-2 mt-0.5">
                                            {issue.repo_name && (
                                                <Badge bg="secondary" className="border border-secondary-subtle" style={{ fontSize: '0.65rem' }}>
                                                    {issue.repo_name}
                                                </Badge>
                                            )}
                                            <span className="small text-muted font-monospace" style={{ fontSize: '0.75rem' }}>
                                                {issue.file || issue.file_path}:{issue.line || issue.line_number}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="cb-badge cb-badge-purple">{issue.category || 'General'}</span>
                                    </td>
                                    <td>
                                        {issue.status === 'resolved' ? (
                                            <Badge bg="success-subtle" className="text-success border border-success-subtle d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                                                <FaCheckCircle size={10} /> Patch Applied
                                            </Badge>
                                        ) : issue.suggested_fix && Object.keys(issue.suggested_fix).length > 0 ? (
                                            <Badge bg="primary-subtle" className="text-primary border border-primary-subtle d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                                                <FaWrench size={10} /> Patch Ready
                                            </Badge>
                                        ) : (
                                            <span className="text-muted small fst-italic">Pending fix</span>
                                        )}
                                    </td>
                                    <td><ConfidenceBadge score={issue.confidence} /></td>
                                    <td className="text-end pe-4">
                                        <Button
                                            variant="outline-primary"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/issues/${issue.id}`);
                                            }}
                                            style={{ borderRadius: 8, fontWeight: 600 }}
                                        >
                                            View & Patch
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="mt-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span className="small text-muted">
                    Page {page} of {totalPages} ({totalCount} total issues)
                </span>
                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(p) => { setPage(p); setLoading(true); }}
                />
            </div>
        </Container>
    );
};

export default IssuesPage;
