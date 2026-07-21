import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, ListGroup, Badge, Spinner, Alert, Form, Nav } from 'react-bootstrap';
import { FaGithub, FaPlug, FaUnlink, FaCheck, FaExternalLinkAlt, FaSearch, FaShieldAlt, FaRocket, FaCodeBranch } from 'react-icons/fa';
import { useAuth } from './AuthContext';
import { useToast } from './components/ToastProvider';
import { apiClient } from './lib/apiClient';

const GitHubConnect = ({ isModal = false, onHide = null }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    user,
    repos,
    connectedRepos,
    connectRepo,
    disconnectRepo,
    login,
    isAuthenticated
  } = useAuth();

  const [connecting, setConnecting] = useState(null);
  const [configuringAccess, setConfiguringAccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(connectedRepos?.length > 0 ? 'connected' : 'available');

  const handleConfigureAppAccess = async () => {
    setConfiguringAccess(true);
    try {
      const data = await apiClient.get('/api/github/install-url');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        showToast('Failed to get GitHub App URL', 'danger');
      }
    } catch (err) {
      showToast(err?.message || 'Failed to open GitHub App configuration', 'danger');
    } finally {
      setConfiguringAccess(false);
    }
  };

  // Sync activeTab if connectedRepos changes and we are on an empty connected tab
  useEffect(() => {
    if (connectedRepos.length === 0 && activeTab === 'connected') {
      setActiveTab('available');
    }
  }, [connectedRepos.length]);

  const handleConnect = async (repo) => {
    setConnecting(repo.full_name);
    try {
      const result = await connectRepo(repo.full_name, repo.id, repo.installation_id);
      if (result && result.success) {
        showToast(`Successfully connected ${repo.full_name}`, 'success');
        if (onHide) onHide();
        // Redirect to the newly connected repo dashboard with "just connected" context
        if (result.repo_id) {
          navigate(`/repos/${result.repo_id}`, {
            state: {
              justConnected: true,
              repoFullName: repo.full_name
            }
          });
        }
      } else {
        showToast(result?.error || 'Failed to connect repository', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'An unexpected error occurred', 'danger');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (repoFullName) => {
    try {
      await disconnectRepo(repoFullName);
      showToast(`Disconnected ${repoFullName}`, 'info');
    } catch (err) {
      showToast('Failed to disconnect repository', 'danger');
    }
  };

  const filteredReposList = (repos || []).filter(repo => {
    const matchesSearch = repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const isConnected = repo.is_connected || connectedRepos.some(cr => cr.full_name === repo.full_name);

    if (activeTab === 'connected') return isConnected;
    if (activeTab === 'available') return !isConnected;
    return true;
  });

  if (!isAuthenticated) {
    return (
      <Card className="github-connect-card overflow-hidden">
        <Card.Body className="text-center py-5 position-relative">
          <div
            style={{
              position: 'absolute',
              top: '-30%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '150%',
              height: '60%',
              background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.1) 0%, transparent 70%)',
              pointerEvents: 'none'
            }}
          />

          <div
            className="mx-auto mb-4 d-flex align-items-center justify-content-center"
            style={{
              width: 100,
              height: 100,
              borderRadius: 28,
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
              border: '2px solid rgba(99, 102, 241, 0.2)'
            }}
          >
            <FaGithub size={48} style={{ color: 'var(--text-secondary)' }} />
          </div>

          <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Connect to GitHub</h4>
          <p className="text-muted mb-4" style={{ maxWidth: 400, margin: '0 auto' }}>
            Sign in with GitHub to enable automated AI-powered code reviews on your repositories.
          </p>

          <Button
            variant="dark"
            size="lg"
            onClick={login}
            className="d-flex align-items-center mx-auto gap-2 px-4"
            style={{
              background: 'linear-gradient(135deg, #24292e 0%, #111827 100%)',
              border: 'none',
              borderRadius: 14,
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.35)'
            }}
          >
            <FaGithub size={22} />
            Sign in with GitHub
          </Button>
        </Card.Body>
      </Card>
    );
  }

  const Content = (
    <div className={isModal ? "py-2" : ""}>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
          <div style={{ position: 'relative' }}>
            <img
              src={user.avatar_url}
              alt={user.login}
              className="rounded-circle"
              style={{
                width: 56,
                height: 56,
                border: '3px solid rgba(79, 138, 201, 0.35)',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)'
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'var(--success-green)',
                border: '3px solid var(--card-background-color)'
              }}
            />
          </div>
          <div>
            <h5 className="mb-0" style={{ fontWeight: 700 }}>{user.name || user.login}</h5>
            <small className="text-muted">@{user.login}</small>
          </div>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" size="sm" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </div>

      <Nav variant="pills" className="bg-light p-1 mb-4" style={{ borderRadius: 12 }}>
        <Nav.Item className="flex-grow-1 text-center">
          <Nav.Link
            active={activeTab === 'connected'}
            onClick={() => setActiveTab('connected')}
            style={{ borderRadius: 10, fontWeight: 600 }}
          >
            My Connected Repos
          </Nav.Link>
        </Nav.Item>
        <Nav.Item className="flex-grow-1 text-center">
          <Nav.Link
            active={activeTab === 'available'}
            onClick={() => setActiveTab('available')}
            style={{ borderRadius: 10, fontWeight: 600 }}
          >
            Add New (All Repos)
          </Nav.Link>
        </Nav.Item>
      </Nav>

      <Form.Group className="mb-3">
        <div className="position-relative">
          <FaSearch
            className="position-absolute"
            style={{ left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <Form.Control
            type="text"
            placeholder={activeTab === 'connected' ? "Search connected repos..." : "Search available repos..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 48, height: 44, borderRadius: 10 }}
          />
        </div>
      </Form.Group>

      <div style={{ maxHeight: 500, overflowY: 'auto' }}>
        {activeTab === 'connected' && connectedRepos.length === 0 ? (
          <div className="text-center py-5 border rounded-3 bg-light-subtle">
            <p className="text-muted mb-0">No repositories connected yet.</p>
            <Button variant="link" onClick={() => setActiveTab('available')}>Browse available repos</Button>
          </div>
        ) : (
          <ListGroup variant="flush">
            {filteredReposList.map(repo => {
              const isConnected = repo.is_connected || connectedRepos.some(cr => cr.full_name === repo.full_name);
              const isConnecting = connecting === repo.full_name;

              return (
                <ListGroup.Item
                  key={repo.id || repo.full_name}
                  className="d-flex justify-content-between align-items-center py-3 px-1 border-bottom"
                  style={{ border: 'none' }}
                >
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <strong style={{ fontSize: '0.95rem' }}>{repo.name}</strong>
                      {repo.private && <Badge bg="light" text="dark" className="border small">Private</Badge>}
                      {isConnected && activeTab === 'available' && <Badge bg="success-subtle" className="text-success border border-success-subtle small">Connected</Badge>}
                    </div>
                    <small className="text-muted d-block">{repo.full_name}</small>
                  </div>
                  <div className="d-flex gap-2">
                    <Button
                      variant="link"
                      size="sm"
                      href={repo.html_url}
                      target="_blank"
                      className="text-muted p-0 me-1"
                    >
                      <FaExternalLinkAlt size={14} />
                    </Button>
                    {isConnected ? (
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDisconnect(repo.full_name)}
                        style={{ borderRadius: 8, fontSize: '0.8rem' }}
                      >
                        <FaUnlink className="me-1" /> Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleConnect(repo)}
                        disabled={isConnecting}
                        style={{ borderRadius: 8, fontSize: '0.8rem', minWidth: 95 }}
                      >
                        {isConnecting ? <Spinner size="sm" /> : <><FaPlug className="me-1" /> Connect</>}
                      </Button>
                    )}
                  </div>
                </ListGroup.Item>
              );
            })}

            {filteredReposList.length === 0 && searchTerm && (
              <div className="text-center py-5">
                <p className="text-muted">No matches found for "{searchTerm}"</p>
              </div>
            )}
          </ListGroup>
        )}
      </div>

      {activeTab === 'connected' && connectedRepos.length > 0 && (
        <Alert variant="info" className="mt-4 mb-0 py-2 px-3 border-0 bg-info-subtle d-flex align-items-center gap-2" style={{ borderRadius: 10 }}>
          <FaRocket className="text-info" />
          <small>Automated reviews are active for your {connectedRepos.length} connected repos.</small>
        </Alert>
      )}

      <div className="mt-4 text-center border-top pt-3">
        <p className="text-muted small mb-2">Can't see your repository?</p>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={handleConfigureAppAccess}
          disabled={configuringAccess}
          style={{ borderRadius: 8 }}
        >
          {configuringAccess ? <Spinner size="sm" className="me-1" /> : null}
          Configure GitHub App Access
        </Button>
      </div>
    </div>
  );

  if (isModal) return Content;

  return (
    <Card className="github-connect-card">
      <Card.Body>
        {Content}
      </Card.Body>
    </Card>
  );
};

export default GitHubConnect;
