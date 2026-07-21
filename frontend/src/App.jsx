import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './Dashboard';
import EventsPage from './EventsPage';
import JobsPage from './JobsPage';
import ReviewsPage from './ReviewsPage';
import ReviewDetail from './ReviewDetail';
import IssuesPage from './IssuesPage';
import IssueDetail from './IssueDetail';
import SystemStatus from './SystemStatus';
import './App.css';
import { useAuth } from './AuthContext';

import RepositoryDashboard from './pages/RepositoryDashboard';
import ReviewsHistoryPage from './pages/ReviewsHistoryPage';
import RepoListPage from './pages/RepoListPage';
import ReviewsListPage from './pages/ReviewsListPage';
import ReviewDetailPage from './pages/ReviewDetailPage';
import RepoSettingsPage from './pages/RepoSettingsPage';
import ConnectCallback from './pages/ConnectCallback';
import ComponentShowcase from './pages/ComponentShowcase';
import SearchRepositoriesPage from './pages/SearchRepositoriesPage';
import EnrichedReviewPage from './pages/EnrichedReviewPage';
import AgentsPage from './pages/AgentsPage';
import ConstellationPage from './pages/ConstellationPage';
import TimeTravelPage from './pages/TimeTravelPage';
import FeedbackInsightsPage from './pages/FeedbackInsightsPage';
import CommitsInboxPage from './pages/CommitsInboxPage';
import { ToastProvider } from './components/ToastProvider';
import { MonitoringProvider } from './contexts/MonitoringContext';

import AppShell from './components/layout/AppShell';
import ParallaxBackground from './components/ParallaxBackground';

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <div style={{ color: 'var(--primary-blue)', fontSize: '1.25rem' }}>Preparing your workspace…</div>
      </div>
    );
  }

  // Helper to wrap content in AppShell if authenticated
  const ProtectedRoute = ({ children }) => {
    if (!isAuthenticated) return <Navigate to="/" replace />;
    return <AppShell>{children}</AppShell>;
  };

  return (
    <ToastProvider>
      <MonitoringProvider>
        <ParallaxBackground />
        <Router>
          <Routes>
            {/* Landing/Login page (No AppShell) */}
            <Route
              path="/"
              element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />}
            />

            {/* Authenticated Routes (Wrapped in AppShell) */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

            {/* Repositories & search */}
            <Route path="/repos" element={<ProtectedRoute><RepoListPage /></ProtectedRoute>} />
            <Route path="/repos/:repoId/settings" element={<ProtectedRoute><RepoSettingsPage /></ProtectedRoute>} />
            <Route path="/repos/search" element={<ProtectedRoute><SearchRepositoriesPage /></ProtectedRoute>} />
            <Route path="/repos/:repoId" element={<ProtectedRoute><RepositoryDashboard /></ProtectedRoute>} />
            <Route path="/repos/:repoId/reviews" element={<ProtectedRoute><ReviewsHistoryPage /></ProtectedRoute>} />
            <Route path="/connect/callback" element={<ProtectedRoute><ConnectCallback /></ProtectedRoute>} />

            <Route path="/events" element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />

            {/* Reviews list/detail */}
            <Route path="/reviews" element={<ProtectedRoute><ReviewsListPage /></ProtectedRoute>} />
            <Route path="/reviews/:id" element={<ProtectedRoute><ReviewDetailPage /></ProtectedRoute>} />
            <Route path="/enriched-review" element={<ProtectedRoute><EnrichedReviewPage /></ProtectedRoute>} />
            <Route path="/enriched-review/:tab" element={<ProtectedRoute><EnrichedReviewPage /></ProtectedRoute>} />
            <Route path="/repos/:repoId/enriched-review" element={<ProtectedRoute><EnrichedReviewPage /></ProtectedRoute>} />


            <Route path="/issues" element={<ProtectedRoute><IssuesPage /></ProtectedRoute>} />
            <Route path="/issues/:id" element={<ProtectedRoute><IssueDetail /></ProtectedRoute>} />

            <Route path="/agents" element={<ProtectedRoute><AgentsPage /></ProtectedRoute>} />
            <Route path="/constellation" element={<ProtectedRoute><ConstellationPage /></ProtectedRoute>} />
            <Route path="/time-travel" element={<ProtectedRoute><TimeTravelPage /></ProtectedRoute>} />
            <Route path="/feedback-insights" element={<ProtectedRoute><FeedbackInsightsPage /></ProtectedRoute>} />
            <Route path="/commits" element={<ProtectedRoute><CommitsInboxPage /></ProtectedRoute>} />

            <Route path="/system-status" element={<ProtectedRoute><SystemStatus /></ProtectedRoute>} />

            <Route path="/components" element={<AppShell><ComponentShowcase /></AppShell>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </MonitoringProvider>
    </ToastProvider>
  );
}

export default App;
