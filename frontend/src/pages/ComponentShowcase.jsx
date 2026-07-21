import React, { useState } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import AppShell from '../components/layout/AppShell';
import SeverityBadge from '../components/findings/SeverityBadge';
import ConfidencePill from '../components/findings/ConfidencePill';
import EvidenceDrawer from '../components/findings/EvidenceDrawer';
import RemediationPanel from '../components/findings/RemediationPanel';
import QueueCard from '../components/system/QueueCard';
import WorkerCard from '../components/system/WorkerCard';

const ComponentShowcase = () => {
    const [showEvidence, setShowEvidence] = useState(false);

    const mockFinding = {
        title: 'Possible SQL Injection',
        description: 'User input is concatenated directly into SQL query string.',
        code_snippet: 'query = "SELECT * FROM users WHERE id = " + user_id',
        suggested_fix: {
            content: 'query = "SELECT * FROM users WHERE id = %s" % (user_id,)'
        }
    };

    return (
        <AppShell>
            <Container fluid>
                <h3 className="mb-4">Component Showcase</h3>

                <Row className="mb-4">
                    <Col md={6}>
                        <Card className="h-100">
                            <Card.Header>Findings Components</Card.Header>
                            <Card.Body className="d-flex flex-column gap-3">
                                <div>
                                    <h6>Severity Badges</h6>
                                    <div className="d-flex gap-2">
                                        <SeverityBadge severity="critical" />
                                        <SeverityBadge severity="major" />
                                        <SeverityBadge severity="minor" />
                                        <SeverityBadge severity="info" />
                                    </div>
                                </div>

                                <div>
                                    <h6>Confidence Pills</h6>
                                    <div className="d-flex gap-2">
                                        <ConfidencePill score={0.98} />
                                        <ConfidencePill score={0.85} />
                                        <ConfidencePill score={0.45} />
                                    </div>
                                </div>

                                <div>
                                    <h6>Actions</h6>
                                    <Button onClick={() => setShowEvidence(true)}>Open Evidence Drawer</Button>
                                </div>

                                <RemediationPanel
                                    finding={mockFinding}
                                    onApplyFix={() => alert('Fix Applied!')}
                                />
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col md={6}>
                        <Card className="h-100">
                            <Card.Header>System Components</Card.Header>
                            <Card.Body className="d-flex flex-column gap-3">
                                <QueueCard pending={45} processing={12} failed={3} />

                                <div className="d-flex gap-3">
                                    <WorkerCard workerId="worker-01" status="busy" currentJob="Repo: facebook/react" />
                                    <WorkerCard workerId="worker-02" status="idle" />
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                <EvidenceDrawer
                    show={showEvidence}
                    onHide={() => setShowEvidence(false)}
                    finding={mockFinding}
                />
            </Container>
        </AppShell>
    );
};

export default ComponentShowcase;
