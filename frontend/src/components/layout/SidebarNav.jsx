import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    FaChartPie,
    FaGithub,
    FaCodeBranch,
    FaMicrochip,
    FaLayerGroup,
    FaSun,
    FaMoon,
    FaInbox,
    FaRobot,
    FaSearch,
    FaProjectDiagram,
    FaClock,
    FaSignOutAlt,
    FaCommentDots,
} from 'react-icons/fa';
import { useAuth } from '../../AuthContext';

const SidebarNav = ({ collapsed, theme, toggleTheme }) => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/', { replace: true });
    };
    const navItems = [
        { to: '/dashboard', icon: FaChartPie, label: 'Dashboard' },
        { to: '/repos', icon: FaGithub, label: 'Repositories' },
        { to: '/repos/search', icon: FaSearch, label: 'Connect / Search' },
        { to: '/commits', icon: FaInbox, label: 'Commits Inbox' },
        { to: '/enriched-review',  icon: FaLayerGroup,     label: 'AI Reviews' },
        { to: '/constellation',    icon: FaProjectDiagram, label: 'Constellation' },
        { to: '/time-travel',      icon: FaClock,          label: 'Time Travel' },
        { to: '/reviews', icon: FaCodeBranch, label: 'Review History' },
        { to: '/feedback-insights', icon: FaCommentDots, label: 'Finding Quality' },
        { type: 'divider', label: 'System' },
        { to: '/system-status', icon: FaMicrochip, label: 'Diagnostics' },
    ];

    const getLinkClass = ({ isActive }) => {
        return `qd-sidebar__link${isActive ? ' qd-sidebar__link--active' : ''}`;
    };

    return (
        <div
            className="qd-sidebar"
            style={{ width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)' }}
        >
            {/* Brand */}
            <div className="qd-sidebar__brand">
                <div className="qd-sidebar__brand-icon">
                    CB
                </div>
                {!collapsed && (
                    <span className="qd-sidebar__brand-text">CodeBuster</span>
                )}
            </div>

            {/* Navigation */}
            <nav className="qd-sidebar__nav">
                {navItems.map((item, idx) => {
                    if (item.type === 'divider') {
                        return !collapsed ? (
                            <div key={idx} className="qd-sidebar__section-label">
                                {item.label}
                            </div>
                        ) : (
                            <div key={idx} style={{ height: 1, background: 'var(--sidebar-border)', margin: '8px 12px' }} />
                        );
                    }

                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={getLinkClass}
                            title={collapsed ? item.label : ''}
                        >
                            <Icon size={20} style={{ flexShrink: 0 }} />
                            {!collapsed && <span>{item.label}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Footer: User + Theme Toggle + Logout */}
            <div className="qd-sidebar__footer">
                <div className="qd-sidebar__user">
                    <div className="qd-sidebar__avatar">
                        {user?.login?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    {!collapsed && (
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="qd-sidebar__user-name">
                                {user?.name || user?.login || 'User'}
                            </div>
                            <div className="qd-sidebar__user-role">
                                {user?.login || 'Administrator'}
                            </div>
                        </div>
                    )}
                </div>
                <button
                    className="qd-sidebar__theme-toggle"
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {theme === 'dark' ? <FaSun size={16} /> : <FaMoon size={16} />}
                </button>
                <button
                    className="qd-sidebar__theme-toggle"
                    onClick={handleLogout}
                    title="Sign out"
                    style={{ color: 'var(--sidebar-text, #71717A)' }}
                >
                    <FaSignOutAlt size={15} />
                </button>
            </div>
        </div>
    );
};

export default SidebarNav;
