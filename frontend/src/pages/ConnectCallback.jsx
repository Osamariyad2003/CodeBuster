import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Spinner } from 'react-bootstrap';
import { FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { apiClient } from '../lib/apiClient';

export default function ConnectCallback() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('Syncing your repositories...');
    const [error, setError] = useState(null);
    const [connectedRepos, setConnectedRepos] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const installationId = searchParams.get('installation_id');
        const setupAction = searchParams.get('setup_action');

        if (installationId) {
            syncInstallation(installationId);
        } else {
            setError('Missing installation_id from GitHub. Please try connecting again.');
        }
    }, [searchParams]);

    const syncInstallation = async (installationId) => {
        try {
            setStatus('Fetching your repositories from GitHub...');

            const data = await apiClient.post('/github/installations/sync', {
                installation_id: parseInt(installationId)
            });

            if (data.success) {
                setStatus('Success! Repositories connected.');
                const repos = data.connected_repos || [];
                setConnectedRepos(repos);

                // Deep-link back to the repo the user originally tried to review, if any.
                const pendingFullName = localStorage.getItem('cb_pending_repo_full_name');
                let targetRepo = null;
                if (pendingFullName) {
                    targetRepo = repos.find(r => r.full_name === pendingFullName);
                }

                if (targetRepo) {
                    localStorage.removeItem('cb_pending_repo_full_name');
                    navigate(`/repos/${targetRepo.id}`, {
                        replace: true,
                        state: { justConnected: true, repoFullName: targetRepo.full_name }
                    });
                } else {
                    // Fallback: keep legacy behavior
                    if (repos.length > 0) {
                        localStorage.setItem('newly_connected_repo', repos[0].full_name);
                    }
                    setTimeout(() => {
                        navigate('/repos', { replace: true });
                    }, 2000);
                }
            } else {
                setError(data.error || 'Failed to sync repositories');
            }
        } catch (err) {
            console.error('Sync error:', err);
            setError('Connection error while syncing repositories');
        }
    };

    return (
        <Container className="py-5">
                <div className="text-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    {error ? (
                        <div>
                            <div className="mb-4" style={{ fontSize: '4rem', color: 'var(--danger)' }}>
                                <FaExclamationTriangle />
                            </div>
                            <h3 className="mb-3">Connection Failed</h3>
                            <p className="text-muted mb-4">{error}</p>
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/repos')}
                            >
                                Back to Repositories
                            </button>
                        </div>
                    ) : connectedRepos.length > 0 ? (
                        <div>
                            <div className="mb-4" style={{ fontSize: '4rem', color: 'var(--success-green)' }}>
                                <FaCheckCircle />
                            </div>
                            <h3 className="mb-3">Successfully Connected!</h3>
                            <p className="text-muted mb-4">
                                Connected {connectedRepos.length} {connectedRepos.length === 1 ? 'repository' : 'repositories'}:
                            </p>
                            <ul className="list-unstyled mb-4">
                                {connectedRepos.map(repo => (
                                    <li key={repo.id} className="mb-2">
                                        <strong>{repo.full_name}</strong>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-muted small">Redirecting to your repositories...</p>
                        </div>
                    ) : (
                        <div>
                            <Spinner animation="border" variant="primary" className="mb-4" />
                            <h3 className="mb-3">{status}</h3>
                            <p className="text-muted">
                                CodeBuster is connecting to your GitHub account. This may take a few moments.
                            </p>
                        </div>
                    )}
                </div>
        </Container>
    );
}
