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
    FaRobot,
    FaSearch,
    FaProjectDiagram,
    FaClock,
    FaSignOutAlt,
    FaCommentDots,
    FaBolt,
    FaUser,
    FaWrench,
} from 'react-icons/fa';
import { useAuth } from '../../AuthContext';
import { RabbitIcon, BrandLogo } from '../brand/BrandLogo';

const SidebarNav = ({ collapsed, theme, toggleTheme }) => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/', { replace: true });
    };

    const navItems = [
        { to: '/dashboard', icon: FaChartPie, label: 'Dashboard' },
        { to: '/profile', icon: FaUser, label: 'Profile & Persona' },
        { to: '/repos', icon: FaGithub, label: 'Repositories' },
        { to: '/repos/search', icon: FaSearch, label: 'Connect & Search' },
        { type: 'divider', label: 'Intelligence' },
        { to: '/enriched-review', icon: FaLayerGroup, label: 'AI Reviews' },
        { to: '/agents', icon: FaRobot, label: 'AI Agents' },
        { to: '/constellation', icon: FaProjectDiagram, label: 'Constellation' },
        { to: '/time-travel', icon: FaClock, label: 'Time Travel' },
        { type: 'divider', label: 'Activity' },
        { to: '/issues', icon: FaWrench, label: 'Issues & Patches' },
        { to: '/reviews', icon: FaCodeBranch, label: 'Review History' },
        { to: '/feedback-insights', icon: FaCommentDots, label: 'Finding Quality' },
        { type: 'divider', label: 'System' },
        { to: '/jobs', icon: FaBolt, label: 'Jobs Queue' },
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
            <div
                className="qd-sidebar__brand"
                onClick={() => navigate('/dashboard')}
                style={{ cursor: 'pointer', padding: collapsed ? '16px 8px' : '16px 14px' }}
                title="CodeBuster Dashboard"
            >
                <BrandLogo
                    size={24}
                    badge="AST AI"
                    subtitle="Autonomous Intelligence"
                    collapsed={collapsed}
                    animated
                />
            </div>

            {/* Navigation */}
            <nav className="qd-sidebar__nav">
                {navItems.map((item, index) => {
                    if (item.type === 'divider') {
                        if (collapsed) {
                            return <div key={`div-${index}`} className="qd-sidebar__divider-collapsed" />;
                        }
                        return (
                            <div key={`div-${index}`} className="qd-sidebar__section-title">
                                {item.label}
                            </div>
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
                            <Icon size={18} style={{ flexShrink: 0 }} />
                            {!collapsed && <span>{item.label}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Footer: User + Theme Toggle + Logout */}
            <div className="qd-sidebar__footer">
                <div
                    className="qd-sidebar__user"
                    onClick={() => navigate('/profile')}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                    title="View Profile & AI Tuning"
                >
                    <div className="qd-sidebar__avatar">
                        {user?.login?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    {!collapsed && (
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="qd-sidebar__user-name text-truncate">
                                {user?.name || user?.login || 'User'}
                            </div>
                            <div className="qd-sidebar__user-role text-truncate">
                                {user?.role || user?.login || 'Senior Reviewer'}
                            </div>
                        </div>
                    )}
                </div>
                <div className="d-flex align-items-center gap-1">
                    <button
                        className="qd-sidebar__theme-toggle"
                        onClick={toggleTheme}
                        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {theme === 'dark' ? <FaSun size={15} /> : <FaMoon size={15} />}
                    </button>
                    <button
                        className="qd-sidebar__theme-toggle"
                        onClick={handleLogout}
                        title="Sign out"
                        style={{ color: 'var(--sidebar-text, #71717A)' }}
                    >
                        <FaSignOutAlt size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SidebarNav;
