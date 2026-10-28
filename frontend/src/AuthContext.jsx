import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from './lib/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [repos, setRepos] = useState([]);
  const [connectedRepos, setConnectedRepos] = useState([]);
  const callbackProcessed = useRef(false);

  const fetchRepos = async () => {
    try {
      const response = await apiClient.get('/github/repos');
      console.log('✅ Repos fetched:', response.repos?.length || 0);
      setRepos(response.repos || []);
      return response.repos || [];
    } catch (error) {
      const isNetworkError = error?.status === 0 || error?.originalError?.code === 'ERR_NETWORK';
      console.error('Failed to fetch repos:', isNetworkError ? 'Server unreachable (is the backend running on port 5000?)' : error);
      setRepos([]);
      return [];
    }
  };

  const fetchConnectedRepos = async () => {
    try {
      const response = await apiClient.get('/github/connected-repos');
      console.log('✅ Connected repos fetched:', response.repos?.length || 0);
      setConnectedRepos(response.repos || []);
      return response.repos || [];
    } catch (error) {
      const isNetworkError = error?.status === 0 || error?.originalError?.code === 'ERR_NETWORK';
      console.error('Failed to fetch connected repos:', isNetworkError ? 'Server unreachable (is the backend running?)' : error);
      setConnectedRepos([]);
      return [];
    }
  };

  // ✅ Check authentication status on mount
  useEffect(() => {
    const initAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const authSuccess = params.get('auth_success');
      const authError = params.get('auth_error');

      // ✅ Handle GitHub OAuth callback (exchange the code exactly once)
      if (code && !callbackProcessed.current) {
        callbackProcessed.current = true;
        window.history.replaceState({}, document.title, window.location.pathname);

        try {
          const callbackUrl = state
            ? `/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
            : `/auth/callback?code=${encodeURIComponent(code)}`;

          const response = await apiClient.get(callbackUrl);
          if (response?.user) {
            setUser(response.user);
          }
          await checkAuth();
          window.history.replaceState({}, document.title, '/dashboard');
        } catch (err) {
          console.error('Callback error:', err);
          window.history.replaceState({}, document.title, '/');
        } finally {
          setLoading(false);
        }
        return;
      }

      // ✅ Handle auth_success param
      if (authSuccess) {
        await checkAuth();
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      // ✅ Handle auth_error param
      if (authError) {
        console.error('Auth error:', authError);
        window.history.replaceState({}, '', window.location.pathname);
        setLoading(false);
        return;
      }

      // ✅ Normal auth check (no callback params)
      await checkAuth();
    };

    initAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await apiClient.get('/auth/user');
      if (response && response.authenticated && response.user) {
        setUser(response.user);
        await fetchRepos();
        await fetchConnectedRepos();
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      const response = await apiClient.get('/auth/github');
      if (response && response.auth_url) {
        window.location.href = response.auth_url;
        return;
      }
      throw new Error(response?.error || 'Failed to retrieve GitHub authentication URL');
    } catch (err) {
      console.error('Login redirection failed:', err);
      throw err;
    }
  };

  const demoLogin = async () => {
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/demo');
      if (response && response.user) {
        setUser(response.user);
        await fetchRepos();
        await fetchConnectedRepos();
        return response.user;
      }
      throw new Error('Failed to establish demo session');
    } catch (err) {
      console.error('Demo login failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
      setUser(null);
      setRepos([]);
      setConnectedRepos([]);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const connectRepo = useCallback(async (repoFullName, repoId, installationId) => {
    try {
      const response = await apiClient.post('/github/connect', {
        repo_full_name: repoFullName,
        repo_id: repoId,
        installation_id: installationId
      });
      if (response.success) {
        await fetchConnectedRepos();
        await fetchRepos();
        return { success: true, repo_id: response.repo_id };
      }
    } catch (error) {
      console.error('Failed to connect repo:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const disconnectRepo = useCallback(async (repoFullName) => {
    try {
      await apiClient.post('/github/disconnect', { repo_full_name: repoFullName });
      await fetchConnectedRepos();
      await fetchRepos();
    } catch (error) {
      console.error('Failed to disconnect repo:', error);
    }
  }, []);

  const isAuthenticated = !!user; // ✅ Derived from user state

  const value = {
    isAuthenticated,
    user,
    loading,
    login,
    demoLogin,
    logout,
    connectedRepos,
    setConnectedRepos,
    repos,
    setRepos,
    connectRepo,
    disconnectRepo
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
