import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col } from 'react-bootstrap';
import {
    getScoreTrend,
    getIssuesByCategory,
    getRiskHeatmap,
    getReviewActivity,
    getSeverityTrend,
} from '../../lib/apiClient';
import { apiClient } from '../../lib/apiClient';

import {
    RiskScoreGauge,
    HealthTimelineChart,
    IssueCategoryDonut,
    SecurityVulnerabilityTrend,
    PRReviewActivityChart,
    CodeQualityBreakdown,
    CommitHealthDualAxis,
    RiskHeatmap,
} from '../charts';

const AnalyticsView = ({ repoId }) => {
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState({});
    const [data, setData] = useState({
        scoreTrend: [],
        issuesByCategory: [],
        riskHeatmap: [],
        reviewActivity: [],
        severityTrend: [],
        stats: null,
        qualityBreakdown: [],
        commitHealth: [],
    });

    const fetchAll = useCallback(async () => {
        if (!repoId) return;

        const keys = [
            'scoreTrend', 'issuesByCategory', 'riskHeatmap',
            'reviewActivity', 'severityTrend', 'stats',
            'qualityBreakdown', 'commitHealth',
        ];
        setLoading(keys.reduce((o, k) => ({ ...o, [k]: true }), {}));

        const fetchers = [
            getScoreTrend(repoId, days).catch(() => []),
            getIssuesByCategory(repoId).catch(() => []),
            getRiskHeatmap(repoId).catch(() => []),
            getReviewActivity(repoId, days).catch(() => []),
            getSeverityTrend(repoId, days).catch(() => []),
            apiClient.get(`/api/repos/${repoId}/stats`).catch(() => ({})),
            // quality breakdown: derive from score trend (category_scores per review)
            apiClient.get(`/api/repos/${repoId}/latest-review`).catch(() => ({})),
            // commit health: merge score trend with commit data
            apiClient.get(`/api/repos/${repoId}/commits`).catch(() => ({ commits: [] })),
        ];

        const results = await Promise.allSettled(fetchers);
        const vals = results.map((r) => (r.status === 'fulfilled' ? r.value : null));

        const scoreTrend = Array.isArray(vals[0]) ? vals[0] : [];
        const statsObj = vals[5]?.stats || vals[5] || {};

        // Build quality breakdown from latest review's category_scores + trend
        let qualityBreakdown = [];
        try {
            const latestReview = vals[6]?.review || vals[6];
            if (latestReview?.category_scores) {
                const cs = typeof latestReview.category_scores === 'string'
                    ? JSON.parse(latestReview.category_scores)
                    : latestReview.category_scores;
                const dateStr = (latestReview.completed_at || latestReview.created_at || '').slice(0, 10) || 'Latest';
                qualityBreakdown = [{ date: dateStr, ...cs }];
            }
        } catch (_) {}

        // Build commit-health dual-axis data
        let commitHealth = [];
        try {
            const commits = vals[7]?.commits || (Array.isArray(vals[7]) ? vals[7] : []);
            // Group commits by date
            const commitsByDate = {};
            commits.forEach((c) => {
                const d = (c.committed_at || c.created_at || c.date || '').slice(0, 10);
                if (d) commitsByDate[d] = (commitsByDate[d] || 0) + 1;
            });
            // Merge with score trend
            const scoreByDate = {};
            scoreTrend.forEach((s) => {
                const d = (s.date || '').slice(0, 10);
                if (d) scoreByDate[d] = s.overall_score ?? s.score ?? 0;
            });
            const allDates = [...new Set([...Object.keys(commitsByDate), ...Object.keys(scoreByDate)])].sort();
            commitHealth = allDates.map((d) => ({
                date: d,
                commits: commitsByDate[d] || 0,
                score: scoreByDate[d] ?? null,
            }));
        } catch (_) {}

        setData({
            scoreTrend,
            issuesByCategory: Array.isArray(vals[1]) ? vals[1] : [],
            riskHeatmap: Array.isArray(vals[2]) ? vals[2] : [],
            reviewActivity: Array.isArray(vals[3]) ? vals[3] : [],
            severityTrend: Array.isArray(vals[4]) ? vals[4] : [],
            stats: statsObj,
            qualityBreakdown,
            commitHealth,
        });

        setLoading(keys.reduce((o, k) => ({ ...o, [k]: false }), {}));
    }, [repoId, days]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const healthScore = data.stats?.health ?? data.scoreTrend?.[data.scoreTrend.length - 1]?.overall_score ?? 0;
    const criticalCount = data.issuesByCategory?.find(
        (c) => (c.category || '').toLowerCase() === 'security'
    )?.count || 0;

    return (
        <div className="analytics-view">
            {/* Row 1: Gauge + Health Timeline */}
            <Row className="mb-3 g-3">
                <Col xs={12} md={4}>
                    <RiskScoreGauge
                        score={healthScore}
                        criticalCount={criticalCount}
                        loading={loading.stats}
                    />
                </Col>
                <Col xs={12} md={8}>
                    <HealthTimelineChart
                        data={data.scoreTrend}
                        days={days}
                        onDaysChange={setDays}
                        loading={loading.scoreTrend}
                    />
                </Col>
            </Row>

            {/* Row 2: Issue Donut + Vulnerability Trend */}
            <Row className="mb-3 g-3">
                <Col xs={12} md={6}>
                    <IssueCategoryDonut
                        data={data.issuesByCategory}
                        loading={loading.issuesByCategory}
                    />
                </Col>
                <Col xs={12} md={6}>
                    <SecurityVulnerabilityTrend
                        data={data.severityTrend}
                        days={days}
                        onDaysChange={setDays}
                        loading={loading.severityTrend}
                    />
                </Col>
            </Row>

            {/* Row 3: Review Activity + Quality Breakdown */}
            <Row className="mb-3 g-3">
                <Col xs={12} md={6}>
                    <PRReviewActivityChart
                        data={data.reviewActivity}
                        days={days}
                        onDaysChange={setDays}
                        loading={loading.reviewActivity}
                    />
                </Col>
                <Col xs={12} md={6}>
                    <CodeQualityBreakdown
                        data={data.qualityBreakdown}
                        loading={loading.qualityBreakdown}
                    />
                </Col>
            </Row>

            {/* Row 4: Commit Health + Risk Heatmap */}
            <Row className="mb-3 g-3">
                <Col xs={12} md={8}>
                    <CommitHealthDualAxis
                        data={data.commitHealth}
                        loading={loading.commitHealth}
                    />
                </Col>
                <Col xs={12} md={4}>
                    <RiskHeatmap
                        data={data.riskHeatmap}
                        loading={loading.riskHeatmap}
                    />
                </Col>
            </Row>
        </div>
    );
};

export default AnalyticsView;
