import React, { useState, useEffect } from 'react';
import { Table, Badge, Button, Form, InputGroup } from 'react-bootstrap';
import { FaSearch, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { Pagination } from '../Pagination';
import { SkeletonTable } from '../Skeleton';
import './IssueTable.css';
import { getReviewIssues } from '../../lib/apiClient';
import { useToast } from '../ToastProvider';

/**
 * Issues table with filters (severity, category), search, sort, pagination.
 * Props: { reviewId: string, initialSeverity?, initialCategory?, onSelectIssue?: (issue) => void }
 * State: items, total, limit, offset, loading, severity, category, search, sort
 */
export default function IssueTable({
    reviewId,
    initialSeverity = '',
    initialCategory = '',
    onSelectIssue
}) {
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [limit] = useState(20);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [severity, setSeverity] = useState(initialSeverity);
    const [category, setCategory] = useState(initialCategory);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('severity');
    const { showToast } = useToast();

    const fetchIssues = async (off = 0) => {
        if (!reviewId) return;
        setLoading(true);
        try {
            const params = { limit, offset: off, sort };
            if (severity) params.severity = severity;
            if (category) params.category = category;
            if (search) params.search = search;
            const res = await getReviewIssues(reviewId, params);
            setItems(res.items || []);
            setTotal(res.total ?? 0);
            setOffset(off);
        } catch (e) {
            showToast('Failed to load issues', 'danger');
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIssues(0);
    }, [reviewId, severity, category, sort]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchIssues(0);
    };

    const severityBadge = (sev) => {
        const v = (sev || '').toLowerCase();
        const bg = v === 'critical' ? 'danger' : v === 'major' ? 'warning' : v === 'minor' ? 'info' : 'secondary';
        return <Badge bg={bg}>{sev || '—'}</Badge>;
    };

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return (
        <div className="issue-table">
            <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                <Form.Select
                    size="sm"
                    style={{ width: 'auto' }}
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                >
                    <option value="">All severities</option>
                    <option value="critical">Critical</option>
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                    <option value="info">Info</option>
                </Form.Select>
                <Form.Select
                    size="sm"
                    style={{ width: 'auto' }}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                >
                    <option value="">All categories</option>
                    <option value="security">Security</option>
                    <option value="secrets">Secrets</option>
                    <option value="dependencies">Dependencies</option>
                    <option value="code_quality">Code Quality</option>
                    <option value="performance">Performance</option>
                </Form.Select>
                <Form onSubmit={handleSearch} className="d-flex flex-grow-1">
                    <InputGroup size="sm">
                        <Form.Control
                            placeholder="Search issues..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Button type="submit" variant="outline-secondary">
                            <FaSearch />
                        </Button>
                    </InputGroup>
                </Form>
                <Form.Select size="sm" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="severity">Sort by severity</option>
                    <option value="confidence">Sort by confidence</option>
                </Form.Select>
            </div>
            {loading ? (
                <div className="py-4">
                    <SkeletonTable rows={5} columns={6} />
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-4 text-muted">No issues match the filters.</div>
            ) : (
                <>
                    <Table hover responsive size="sm">
                        <thead className="table-light">
                            <tr>
                                <th>Severity</th>
                                <th>Title</th>
                                <th>Category</th>
                                <th>File</th>
                                <th>Confidence</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((issue) => (
                                <tr
                                    key={issue.id}
                                    className={onSelectIssue ? "tactile-row" : ""}
                                    style={onSelectIssue ? { cursor: 'pointer' } : {}}
                                    onClick={() => onSelectIssue?.(issue)}
                                    onMouseMove={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const y = e.clientY - rect.top;
                                        e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                                        e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
                                    }}
                                >
                                    <td>{severityBadge(issue.severity)}</td>
                                    <td className="text-truncate" style={{ maxWidth: 280 }}>{issue.title}</td>
                                    <td><Badge bg="light" text="dark">{issue.module || issue.category_key || '—'}</Badge></td>
                                    <td className="text-truncate small" style={{ maxWidth: 180 }}>{issue.file || issue.file_path || '—'}</td>
                                    <td>{issue.confidence != null ? `${Math.round(issue.confidence * 100)}%` : '—'}</td>
                                    <td>
                                        {onSelectIssue && (
                                            <Button variant="link" size="sm" className="p-0" onClick={(e) => { e.stopPropagation(); onSelectIssue(issue); }}>
                                                <FaInfoCircle /> Details
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                    {totalPages > 1 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={(p) => fetchIssues((p - 1) * limit)}
                        />
                    )}
                </>
            )}
        </div>
    );
}
