import React, { useState, useRef, useEffect } from 'react';
import { FaBars, FaBell, FaSearch, FaRobot, FaUser, FaCodeBranch, FaSignOutAlt, FaShieldAlt, FaSun, FaMoon } from 'react-icons/fa';
import { Link, useLocation, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { useTheme } from '../../useTheme';
import AiHealthBadge from './AiHealthBadge';

const labelMap = {
    dashboard: 'Dashboard',
    profile: 'Profile & Settings',
    repos: 'Repositories',
    search: 'Search',
    reviews: 'Review History',
    events: 'Webhook Events',
    jobs: 'Jobs Queue',
    'system-status': 'System Status',
    settings: 'Settings',
    components: 'Components',
    connect: 'Connect',
    callback: 'Callback',
    'enriched-review': 'AI Reviews',
    'constellation': 'Constellation',
    'time-travel': 'Time Travel',
    agents: 'AI Agents',
    'feedback-insights': 'Finding Quality',
    commits: 'Commits Inbox',
    issues: 'Issues & Patches',
};

const aiReviewsTabs = [
    { to: '/enriched-review', label: 'Overview' },
    { to: '/enriched-review/settings', label: 'Settings' },
];

const TopBar = ({ onToggleSidebar }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [theme, toggleTheme] = useTheme();
    const isAiReviewsSection = location.pathname.includes('enriched-review');

    const [showUserMenu, setShowUserMenu] = useState(false);
    const dropdownRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        setShowUserMenu(false);
        await logout();
        navigate('/', { replace: true });
    };

    const getBreadcrumbs = () => {
        const segments = location.pathname.split('/').filter(Boolean);
        if (segments.length === 0) {
            return [{ label: 'Dashboard', path: '/dashboard', isLast: true }];
        }
        return segments.map((seg, i) => ({
            label: labelMap[seg] || decodeURIComponent(seg),
            path: '/' + segments.slice(0, i + 1).join('/'),
            isLast: i === segments.length - 1,
        }));
    };

    const breadcrumbs = getBreadcrumbs();
    const userName = user?.name || user?.login || 'User';

    const renderUserMenu = () => (
        <div className="cb-topbar-popover" style={{ zIndex: 1050 }}>
            <div className="cb-popover-header">
                {user?.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt={userName}
                        className="cb-popover-avatar"
                        style={{ objectFit: 'cover' }}
                    />
                ) : (
                    <div className="cb-popover-avatar">
                        {(userName || 'U').charAt(0).toUpperCase()}
                    </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="cb-popover-user-name text-truncate">{userName}</div>
                    <div className="cb-popover-user-role">@{user?.login || userName}</div>
                </div>
            </div>

            <Link
                to="/profile"
                className="cb-popover-item"
                onClick={() => setShowUserMenu(false)}
            >
                <FaUser size={13} style={{ color: '#FF570A' }} />
                <span>My Profile & AI Persona</span>
            </Link>

            <Link
                to="/repos"
                className="cb-popover-item"
                onClick={() => setShowUserMenu(false)}
            >
                <FaCodeBranch size={13} style={{ color: '#25E2A8' }} />
                <span>Connected Repositories</span>
            </Link>

            <Link
                to="/agents"
                className="cb-popover-item"
                onClick={() => setShowUserMenu(false)}
            >
                <FaRobot size={13} style={{ color: '#687FF5' }} />
                <span>AI Review Agents</span>
            </Link>

            <button
                type="button"
                className="cb-popover-item"
                onClick={() => {
                    toggleTheme();
                    setShowUserMenu(false);
                }}
            >
                {theme === 'dark' ? <FaSun size={13} style={{ color: '#F59E0B' }} /> : <FaMoon size={13} style={{ color: '#687FF5' }} />}
                <span>Switch to {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <div className="cb-popover-divider" />

            <button
                className="cb-popover-item cb-popover-item--danger"
                onClick={handleLogout}
            >
                <FaSignOutAlt size={13} />
                <span>Sign Out</span>
            </button>
        </div>
    );

    if (isAiReviewsSection) {
        return (
            <header className="qd-topbar qd-topbar--enriched position-relative">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        className="qd-topbar__action d-md-none"
                        onClick={onToggleSidebar}
                        aria-label="Toggle sidebar"
                    >
                        <FaBars size={15} />
                    </button>
                    <div className="ai-reviews-title-wrapper d-flex align-items-center gap-2">
                        <span className="ai-reviews-title">AI Reviews</span>
                        <span className="ai-badge">AST</span>
                    </div>
                    <nav className="ai-reviews-tabs d-none d-md-flex">
                        {aiReviewsTabs.map((tab) => (
                            <NavLink
                                key={tab.to}
                                to={tab.to}
                                end={tab.to === '/enriched-review'}
                                className={({ isActive }) =>
                                    `ai-reviews-tab ${isActive ? 'ai-reviews-tab--active' : ''}`
                                }
                            >
                                {tab.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>
                <div className="qd-topbar__actions d-flex align-items-center gap-2">
                    <AiHealthBadge />
                    <button
                        className="qd-topbar__action"
                        aria-label="Search"
                        onClick={() => navigate('/repos/search')}
                        title="Search Repositories"
                    >
                        <FaSearch size={14} />
                    </button>
                    <button className="qd-topbar__action qd-topbar__action--notification" aria-label="Notifications">
                        <FaBell size={14} />
                        <span className="qd-topbar__notification-dot" />
                    </button>
                    <div
                        ref={dropdownRef}
                        className="qd-topbar__user-dropdown position-relative"
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        style={{ cursor: 'pointer', zIndex: 1040 }}
                        title="Click to view profile & options"
                    >
                        {user?.avatar_url ? (
                            <img
                                src={user.avatar_url}
                                alt={userName}
                                className="qd-topbar__avatar qd-topbar__avatar--sm"
                                style={{ objectFit: 'cover' }}
                            />
                        ) : (
                            <div className="qd-topbar__avatar qd-topbar__avatar--sm">
                                {(userName || 'U').charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="qd-topbar__user-name d-none d-sm-inline">{userName}</span>
                        <span className="qd-topbar__chevron">▼</span>

                        {showUserMenu && renderUserMenu()}
                    </div>
                </div>
            </header>
        );
    }

    return (
        <header className="qd-topbar position-relative" style={{ zIndex: 1030 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                    className="qd-topbar__action d-md-none"
                    onClick={onToggleSidebar}
                    aria-label="Toggle sidebar"
                >
                    <FaBars size={15} />
                </button>
                <nav className="qd-breadcrumbs">
                    {breadcrumbs.map((crumb, i) => (
                        <React.Fragment key={crumb.path}>
                            {i > 0 && <span className="qd-breadcrumbs__sep">›</span>}
                            {crumb.isLast ? (
                                <span className="qd-breadcrumbs__current">{crumb.label}</span>
                            ) : (
                                <Link to={crumb.path} className="qd-breadcrumbs__link">
                                    {crumb.label}
                                </Link>
                            )}
                        </React.Fragment>
                    ))}
                </nav>
            </div>
            <div className="qd-topbar__actions">
                <AiHealthBadge />
                <button
                    className="qd-topbar__action"
                    aria-label="Search"
                    onClick={() => navigate('/repos/search')}
                    title="Search Repositories"
                >
                    <FaSearch size={13} />
                </button>
                <button className="qd-topbar__action qd-topbar__action--notification" aria-label="Notifications">
                    <FaBell size={13} />
                    <span className="qd-topbar__notification-dot" />
                </button>
                {userName && (
                    <div
                        ref={dropdownRef}
                        className="qd-topbar__user-dropdown position-relative"
                        style={{ marginLeft: 4, cursor: 'pointer', zIndex: 1040 }}
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        title="Click to view profile & options"
                    >
                        {user?.avatar_url ? (
                            <img
                                src={user.avatar_url}
                                alt={userName}
                                className="qd-topbar__avatar qd-topbar__avatar--sm"
                                style={{ objectFit: 'cover' }}
                            />
                        ) : (
                            <div className="qd-topbar__avatar qd-topbar__avatar--sm">
                                {userName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="qd-topbar__user-name d-none d-lg-inline">{userName}</span>
                        <span className="qd-topbar__chevron" style={{ fontSize: '9px', marginLeft: 4 }}>▼</span>

                        {showUserMenu && renderUserMenu()}
                    </div>
                )}
            </div>
        </header>
    );
};

export default TopBar;
