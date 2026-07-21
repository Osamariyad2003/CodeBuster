import React from 'react';
import { FaBars, FaBell, FaSearch } from 'react-icons/fa';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import AiHealthBadge from './AiHealthBadge';

const labelMap = {
    dashboard: 'Dashboard',
    repos: 'Repositories',
    search: 'Search',
    reviews: 'Pull Requests',
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
};

const aiReviewsTabs = [
    { to: '/enriched-review', label: 'Overview' },
    { to: '/enriched-review/settings', label: 'Settings' },
];

const TopBar = ({ onToggleSidebar }) => {
    const location = useLocation();
    const { user } = useAuth();
    const isAiReviewsSection = location.pathname.includes('enriched-review');

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
    const userName = user?.login || user?.name || user?.username || 'User';

    if (isAiReviewsSection) {
        return (
            <div className="qd-topbar qd-topbar--ai-reviews">
                <div className="d-flex align-items-center gap-3">
                    <button
                        className="qd-topbar__action d-md-none"
                        onClick={onToggleSidebar}
                        aria-label="Toggle sidebar"
                    >
                        <FaBars size={16} />
                    </button>
                    <div className="ai-reviews-header">
                        <div className="ai-reviews-header__logo">A</div>
                        <span className="ai-reviews-header__title">AI Reviews</span>
                    </div>
                    <nav className="ai-reviews-tabs ai-reviews-tabs--topbar">
                        {aiReviewsTabs.map((tab) => (
                            <NavLink
                                key={tab.to}
                                to={tab.to}
                                className={({ isActive }) =>
                                    `ai-reviews-tabs__item${isActive ? ' active' : ''}`
                                }
                                end={tab.to === '/enriched-review'}
                            >
                                {tab.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>
                <div className="qd-topbar__actions d-flex align-items-center gap-2">
                    <AiHealthBadge />
                    <button className="qd-topbar__action" aria-label="Search">
                        <FaSearch size={14} />
                    </button>
                    <button className="qd-topbar__action qd-topbar__action--notification" aria-label="Notifications">
                        <FaBell size={14} />
                        <span className="qd-topbar__notification-dot" />
                    </button>
                    <div className="qd-topbar__user-dropdown">
                        <div className="qd-topbar__avatar qd-topbar__avatar--sm">
                            {(userName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="qd-topbar__user-name d-none d-sm-inline">{userName}</span>
                        <span className="qd-topbar__chevron">▼</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="qd-topbar">
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
                <button className="qd-topbar__action" aria-label="Search">
                    <FaSearch size={13} />
                </button>
                <button className="qd-topbar__action qd-topbar__action--notification" aria-label="Notifications">
                    <FaBell size={13} />
                    <span className="qd-topbar__notification-dot" />
                </button>
                {userName && (
                    <div className="qd-topbar__user-dropdown" style={{ marginLeft: 4 }}>
                        <div className="qd-topbar__avatar qd-topbar__avatar--sm">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="qd-topbar__user-name d-none d-lg-inline">{userName}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TopBar;
