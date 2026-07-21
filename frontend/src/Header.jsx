import React, { useState, useEffect } from 'react';
import { Navbar, Container, Button, Nav, Dropdown, Badge } from 'react-bootstrap';
import { useTheme } from './useTheme';
import { useAuth } from './AuthContext';
import { FaGithub, FaMoon, FaSun, FaSignOutAlt, FaUser, FaCode, FaBolt, FaRocket } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import RepoConfigModal from './RepoConfigModal';

const Header = () => {
  const { user, logout, isAuthenticated, repos, connectedRepos } = useAuth();
  const navigate = useNavigate();
  const [showRepoModal, setShowRepoModal] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <Navbar
      expand="lg"
      sticky="top"
      className="py-3"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}
    >
      <Container fluid className="px-4">
        {/* Brand */}
        <Navbar.Brand
          href="/"
          className="d-flex align-items-center gap-3 fw-bold"
          style={{ cursor: 'pointer', textDecoration: 'none' }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: 'var(--primary-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
            }}
          >
            <FaCode size={24} style={{ color: 'white' }} />
          </div>
          <div className="d-flex flex-column">
            <div className="d-flex align-items-center gap-2">
              <span style={{
                fontWeight: 700,
                fontSize: '1.25rem',
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em'
              }}>
                CodeBuster
              </span>
              <Badge
                style={{
                  background: 'rgba(79, 70, 229, 0.1)',
                  color: 'var(--primary-brand)',
                  border: '1px solid rgba(79, 70, 229, 0.2)',
                  fontSize: '0.65rem',
                  padding: '4px 8px',
                  fontWeight: 700,
                  borderRadius: '6px'
                }}
              >
                AI
              </Badge>
            </div>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--text-muted)'
            }}>
              AI Code Review Platform
            </span>
          </div>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto d-flex align-items-center gap-3">
            {isAuthenticated && user ? (
              <>
                {/* Navigation Links */}
                <Nav.Link
                  href="/repos"
                  style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: 'var(--primary-brand)',
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid rgba(79, 70, 229, 0.2)',
                    background: 'rgba(79, 70, 229, 0.05)'
                  }}
                >
                  <FaRocket className="me-2" />
                  Repositories
                </Nav.Link>
                <Nav.Link
                  href="/dashboard"
                  style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    padding: '8px 16px',
                    borderRadius: 8
                  }}
                >
                  Dashboard
                </Nav.Link>

                <Nav.Link
                  href="/events"
                  style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    padding: '8px 16px',
                    borderRadius: 8
                  }}
                >
                  Events
                </Nav.Link>
                <Nav.Link
                  href="/jobs"
                  style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    padding: '8px 16px',
                    borderRadius: 8
                  }}
                >
                  Jobs
                </Nav.Link>
                <Nav.Link
                  href="/reviews"
                  style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    padding: '8px 16px',
                    borderRadius: 8
                  }}
                >
                  Reviews
                </Nav.Link>
                <Nav.Link
                  href="/issues"
                  style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    padding: '8px 16px',
                    borderRadius: 8
                  }}
                >
                  Issues
                </Nav.Link>

                {/* Repositories Dropdown */}
                <Dropdown align="end">
                  <Dropdown.Toggle
                    variant="link"
                    className="d-flex align-items-center gap-2 text-decoration-none p-1 px-3 rounded-pill"
                    style={{
                      border: '1px solid var(--border-subtle)',
                      background: 'white',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      color: 'var(--text-primary)'
                    }}
                    id="dropdown-repos"
                    aria-label="Repositories menu"
                  >
                    <FaGithub size={18} />
                    <span>My Repos</span>
                    {connectedRepos.length > 0 && (
                      <Badge pill bg="primary" style={{ fontSize: '0.7rem' }}>
                        {connectedRepos.length}
                      </Badge>
                    )}
                  </Dropdown.Toggle>

                  <Dropdown.Menu
                    style={{
                      width: '320px',
                      maxHeight: '480px',
                      overflowY: 'auto',
                      padding: '12px',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-2 px-2">
                      <h6 className="mb-0 fw-bold" style={{ fontSize: '0.9rem' }}>Repositories</h6>
                      <Button variant="link" size="sm" className="p-0 text-decoration-none" onClick={() => setShowRepoModal(true)}>
                        Configure
                      </Button>
                    </div>

                    <Dropdown.Header className="px-2 pt-0 small text-uppercase fw-bold text-muted" style={{ fontSize: '0.7rem' }}>
                      Active
                    </Dropdown.Header>
                    {connectedRepos.length > 0 ? (
                      connectedRepos.map(repo => (
                        <Dropdown.Item
                          key={repo.full_name}
                          className="px-2 py-2 rounded-2"
                          onClick={() => navigate(`/reviews?repo=${repo.full_name}`)}
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="text-truncate fw-medium" style={{ maxWidth: '200px', fontSize: '0.85rem' }}>{repo.name}</span>
                            <Badge bg="success-subtle" className="text-success border border-success-subtle small" style={{ fontSize: '0.65rem' }}>Live</Badge>
                          </div>
                          <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>{repo.full_name}</small>
                        </Dropdown.Item>
                      ))
                    ) : (
                      <div className="px-2 py-3 text-center text-muted small">No active repositories</div>
                    )}

                    <Dropdown.Divider />

                    <Dropdown.Header className="px-2 small text-uppercase fw-bold text-muted" style={{ fontSize: '0.7rem' }}>
                      Available to Connect
                    </Dropdown.Header>
                    {(repos || [])
                      .filter(repo => !(connectedRepos || []).some(cr => cr.full_name === repo.full_name))
                      .slice(0, 10)
                      .map(repo => (
                        <Dropdown.Item
                          key={repo.id || repo.full_name}
                          className="px-2 py-2 rounded-2 opacity-75"
                          onClick={() => setShowRepoModal(true)}
                        >
                          <span className="text-truncate d-block" style={{ maxWidth: '250px', fontSize: '0.85rem' }}>{repo.name}</span>
                          <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>{repo.full_name}</small>
                        </Dropdown.Item>
                      ))
                    }

                    {(repos || []).filter(repo => !(connectedRepos || []).some(cr => cr.full_name === repo.full_name)).length === 0 && (
                      <div className="px-2 py-2 text-center text-muted small">No new repositories found</div>
                    )}

                    <Dropdown.Divider />
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-100 mt-1"
                      style={{ borderRadius: 8 }}
                      onClick={() => setShowRepoModal(true)}
                    >
                      Connect More Repos
                    </Button>
                  </Dropdown.Menu>
                </Dropdown>

                <Dropdown align="end">
                  <Dropdown.Toggle
                    variant="link"
                    className="d-flex align-items-center gap-2 text-decoration-none p-1 rounded-pill"
                    style={{
                      border: '1px solid var(--border-subtle)',
                      background: 'white'
                    }}
                    id="dropdown-user"
                    aria-label="User profile menu"
                  >
                    {user?.avatar_url && (
                      <img
                        src={user.avatar_url}
                        alt="Avatar"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%'
                        }}
                      />
                    )}
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', paddingRight: '0.5rem' }}>
                      {user?.name || user?.login || 'User'}
                    </span>
                  </Dropdown.Toggle>

                  <Dropdown.Menu
                    style={{
                      background: 'white',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      padding: '8px'
                    }}
                  >
                    <Dropdown.Item
                      disabled
                      style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}
                    >
                      <FaUser size={14} className="me-2" />
                      {user?.email || 'No email'}
                    </Dropdown.Item>
                    <Dropdown.Divider style={{ borderColor: 'var(--border-subtle)' }} />
                    <Dropdown.Item
                      onClick={handleLogout}
                      style={{ color: 'var(--color-danger)', borderRadius: '8px' }}
                    >
                      <FaSignOutAlt size={14} className="me-2" />
                      Logout
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </>
            ) : (
              <Button
                onClick={() => navigate('/')}
                className="d-flex align-items-center gap-2"
                style={{
                  background: 'var(--primary-brand)',
                  color: 'white',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 20px',
                  boxShadow: '0 4px 10px rgba(79, 70, 229, 0.2)'
                }}
              >
                <FaGithub />
                Login
              </Button>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
      <RepoConfigModal show={showRepoModal} onHide={() => setShowRepoModal(false)} />
    </Navbar>
  );
};

export default Header;
