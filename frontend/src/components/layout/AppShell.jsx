import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SidebarNav from './SidebarNav';
import TopBar from './TopBar';
import { useAuth } from '../../AuthContext';
import { useToast } from '../ToastProvider';
import { useTheme } from '../../useTheme';

const FULLSCREEN_ROUTES = ['/time-travel', '/constellation'];

const AppShell = ({ children }) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();
    const { showToast } = useToast();
    const [theme, toggleTheme] = useTheme();

    const isFullscreen = FULLSCREEN_ROUTES.includes(location.pathname);

    useEffect(() => {
        const onAuthRequired = () => {
            logout?.();
            navigate('/', { replace: true });
            showToast?.("You're signed out or your session expired. Please sign in again.", 'warning');
        };
        window.addEventListener('auth-required', onAuthRequired);
        return () => window.removeEventListener('auth-required', onAuthRequired);
    }, [logout, navigate, showToast]);

    return (
        <div className="d-flex vh-100 overflow-hidden" style={{ background: 'var(--content-bg)' }}>
            {/* Sidebar */}
            <div className="d-none d-md-block flex-shrink-0 h-100 z-3">
                <SidebarNav
                    collapsed={sidebarCollapsed}
                    theme={theme}
                    toggleTheme={toggleTheme}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-grow-1 d-flex flex-column h-100 overflow-hidden position-relative">
                {!isFullscreen && (
                    <TopBar onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
                )}

                <main className={`flex-grow-1 app-main ${isFullscreen ? 'overflow-hidden p-0' : 'overflow-auto p-3'}`}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AppShell;
