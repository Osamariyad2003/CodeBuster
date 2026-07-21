import React from 'react';
import { Offcanvas, Badge } from 'react-bootstrap';
import { FaRobot, FaLightbulb } from 'react-icons/fa';

const EvidenceDrawer = ({ show, onHide, finding }) => {
    if (!finding) return null;

    return (
        <Offcanvas show={show} onHide={onHide} placement="end" style={{ width: '500px' }}>
            <Offcanvas.Header closeButton className="border-bottom">
                <Offcanvas.Title className="h5 fw-bold d-flex align-items-center gap-2">
                    <FaRobot className="text-primary" /> AI Evidence
                </Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body className="p-0">
                <div className="p-4 bg-light border-bottom">
                    <h6 className="fw-bold mb-2">{finding.title}</h6>
                    <p className="text-muted small mb-0">{finding.description}</p>
                </div>

                <div className="p-4">
                    <h6 className="fw-bold small text-uppercase text-muted mb-3">Reasoning Trace</h6>

                    {/* RAG Context */}
                    <div className="mb-4">
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <Badge bg="info" className="rounded-pill">Context</Badge>
                            <span className="small fw-bold">Similar Patterns Found</span>
                        </div>
                        <div className="p-3 bg-white border rounded shadow-sm small text-muted">
                            We found 3 similar security issues in <code className="text-dark">auth_provider.py</code> resolved last month. This pattern matches <a href="#" className="text-primary">CVE-2023-XYZ</a>.
                        </div>
                    </div>

                    {/* Tool Output */}
                    <div className="mb-4">
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <Badge bg="secondary" className="rounded-pill">Semgrep</Badge>
                            <span className="small fw-bold">Raw Tool Output</span>
                        </div>
                        <pre className="p-3 bg-dark text-white rounded small overflow-auto">
                            {`{
  "check_id": "python.lang.security.injection",
  "path": "backend/auth.py",
  "start": { "line": 45, "col": 12 }
}`}
                        </pre>
                    </div>

                    {/* Recommendation */}
                    <div className="p-3 rounded border border-success bg-success-subtle">
                        <div className="d-flex align-items-start gap-2">
                            <FaLightbulb className="text-success mt-1" />
                            <div>
                                <span className="fw-bold text-success display-block mb-1">Recommendation</span>
                                <p className="small mb-0 text-success-emphasis">
                                    Use parameterized queries instead of string concatenation to prevent SQL injection.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Offcanvas.Body>
        </Offcanvas>
    );
};

export default EvidenceDrawer;
