import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Table, Badge, Button, Form, Row, Col, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { apiClient } from './lib/apiClient';
import Header from './Header';
import ConfidenceBadge from './components/ConfidenceBadge';
import { Pagination } from './components/Pagination';
import { usePolling } from './hooks/usePolling';

const IssuesPage = () => {
    const navigate = useNavigate();
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        severity: '',
        category: ''
    });

    const fetchIssues = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (filters.severity) params.append('severity', filters.severity);
            if (filters.category) params.append('category', filters.category);
            params.append('page', page);
            params.append('limit', 10);

            const response = await apiClient.get(`/api/issues?${params.toString()}`);
            return response; // response interceptor already returns .data
        } catch (err) {
            console.error('Failed to fetch issues', err);
            return { issues: [], total_pages: 1 };
        }
    }, [filters, page]);

    const { data: issuesData, refetch } = usePolling(fetchIssues, { key: `issues-${JSON.stringify(filters)}-${page}`, interval: 30000 });

    useEffect(() => {
        if (issuesData) {
            setIssues(Array.isArray(issuesData.data) ? issuesData.data : []);
            setTotalPages(issuesData.total_pages || 1);
            setLoading(false);
        }
    }, [issuesData]);

    const handleFilterChange = (e) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setLoading(true); // Show loading while refetching
        setPage(1); // Reset to page 1 on filter change
    };

    return (
        <>
            <Header />
            <Container className="py-5" style={{ maxWidth: 1200 }}>
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h1 style={{ fontWeight: 700, fontSize: '1.75rem', color: 'var(--text-primary)' }}>
                        Findings & Issues
                    </h1>
                </div>

                {/* Filters */}
                <Card className="mb-4 border-0 shadow-sm p-3">
                    <Row className="g-3 align-items-end">
                        <Col md={3}>
                            <Form.Label className="small fw-bold text-muted">Severity</Form.Label>
                            <Form.Select name="severity" value={filters.severity} onChange={handleFilterChange}>
                                <option value="">All Severities</option>
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </Form.Select>
                        </Col>
                        <Col md={3}>
                            <Form.Label className="small fw-bold text-muted">Category</Form.Label>
                            <Form.Select name="category" value={filters.category} onChange={handleFilterChange}>
                                <option value="">All Categories</option>
                                <option value="Security">Security</option>
                                <option value="Quality">Quality</option>
                                <option value="Performance">Performance</option>
                                <option value="Maintainability">Maintainability</option>
                            </Form.Select>
                        </Col>
                        <Col md={2}>
                            <Button variant="outline-secondary" className="w-100" onClick={refetch}>Apply</Button>
                        </Col>
                    </Row>
                </Card>

                <Card className="border-0 shadow-sm" style={{ borderRadius: 'var(--border-radius)', overflow: 'hidden' }}>
                    <Table hover responsive className="mb-0 align-middle">
                        <thead className="bg-light">
                            <tr>
                                <th className="py-3 ps-4">Severity</th>
                                <th className="py-3">Title / Message</th>
                                <th className="py-3">Category</th>
                                <th className="py-3">Confidence</th>
                                <th className="py-3 text-end pe-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-5"><Spinner animation="border" size="sm" /></td></tr>
                            ) : issues.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-5 text-muted">No issues found matching filters.</td></tr>
                            ) : (
                                issues.map(issue => (
                                    <tr key={issue.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/issues/${issue.id}`)}>
                                        <td className="ps-4">
                                            <Badge bg={issue.severity === 'critical' || issue.severity === 'high' ? 'danger' : 'warning'}>
                                                {issue.severity}
                                            </Badge>
                                        </td>
                                        <td style={{ maxWidth: 400 }} className="text-truncate">
                                            <span className="fw-bold d-block text-truncate">{issue.title || issue.message}</span>
                                            <span className="small text-muted">{issue.file_path}:{issue.line_number}</span>
                                        </td>
                                        <td>{issue.category}</td>
                                        <td><ConfidenceBadge score={issue.confidence} /></td>
                                        <td className="text-end pe-4">
                                            <Button variant="link" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/issues/${issue.id}`); }}>
                                                Details
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </Table>
                </Card>

                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(p) => { setPage(p); setLoading(true); }}
                />
            </Container>
        </>
    );
};

export default IssuesPage;
