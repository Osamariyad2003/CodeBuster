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
      const authSuccess = params.get('auth_success');
      const authError = params.get('auth_error');

      // ✅ Handle GitHub OAuth callback
      if (code && !callbackProcessed.current) {
        callbackProcessed.current = true;

        try {
          const response = await apiClient.get(`/auth/callback?code=${code}`);

          if (response) {
            // Check if response contains the user directly (apiClient returns response.data)
            // But auth callback might redirect? No, it returns JSON in the updated code usually, but auth.py redirects?
            // Wait, auth.py/callback returns `redirect(f"{FRONTEND_URL}/dashboard")` on success.
            // apiClient follows redirects transparently in browser fetch? 
            // Valid JSON response expected by apiClient interceptor. 
            // If it redirects, the browser follows it. 

            // Actually, for OAuth callback handling in SPA:
            // The user is redirected TO this page with ?code=...
            // We need to exchange it. 
            // If backend redirects back to dashboard, that's a page navigation.
            // If we fetch it via AJAX, we need to handle the response.

            // auth.py line 178: return redirect(f"{FRONTEND_URL}/dashboard")
            // This is problematic for an AJAX call (apiClient.get).
            // Better if auth.py returns JSON for AJAX or we let the browser handle the navigation.

            // However, the current code in AuthContext uses fetch/axios.
            // Responsive: "const data = await response.json(); setUser(data.user);"
            // This implies the previous backend implementation returned JSON. 
            // BUT my view of auth.py shows it returns a redirect.

            // If auth.py returns a redirect, `apiClient.get` will follow it and return the HTML of the dashboard... which allows JSON parsing error.
            // We should check if we need to change the backend to return JSON or handle the redirect.

            // Let's assume for now we want JSON. CONSTANT CHECK on auth.py:
            // "return redirect(f"{FRONTEND_URL}/dashboard")"

            // If we want to use apiClient, we need the backend to return JSON OR we rely on the session cookie set by the redirect response.
            // But since we are already IN the SPA handling the code, we probably want to exchange it and get the user data without a full page reload if possible, OR just let the redirect happen.

            // If the user visited /auth/callback?code=... directly in browser, backend would redirect them to dashboard.
            // But here we are in React `useEffect`, parsing `window.location.search`.
            // This means we are likely on the `/dashboard` or `/auth/callback` route in frontend.

            // If we are making an AJAX call to `/auth/callback`, we expect data.
            // Converting this to apiClient implies we expect data.

            // Let's stick to the pattern but be careful.
            // If the backend returns a redirect, axios/fetch follows it.
            // If it follows to /dashboard, it gets HTML (index.html).
            // JSON parsing fails.

            // Fix: Backend should return JSON for the token exchange if it's called via AJAX?
            // Or we just update user state.

            // Let's assume we proceed with apiClient, but maybe we should rely on `checkAuth` after the exchange?

            // Let's try to interpret the response.
            // If we use apiClient, and it succeeds (200), we act.

            // REFRESH: auth.py redirects.
            // We should probably change auth.py to return JSON if we want to handle it in SPA cleanly, 
            // OR we just accept the redirect.

            // Wait, if the backend redirects, the `response` variable in `apiClient` interceptor will be the result of the redirected page.
            // If that page is the dashboard (React app), it returns index.html.
            // `response.data` will be the HTML string.
            // `apiClient` interceptor returns `response.data`.

            // If we receive HTML, `setUser` will fail or be garbage.

            // Let's modify `auth.py` first to return JSON instead of redirect? 
            // Or, strictly for the callback, maybe we shouldn't use apiClient if it behaves this way?
            // Actually, the current `AuthContext` uses `fetch`.
            // `const response = await fetch(...)`
            // If fetch follows redirect, it gets the HTML.
            // `const data = await response.json()` -> SyntaxError if HTML.

            // So the current frontend code `AuthContext` EXPECTS JSON.
            // But `auth.py` returns `redirect`.
            // THIS is a bug I should fix in `auth.py` as well!

            // I will update auth.py to return JSON, and AuthContext to use apiClient.

            // Re-reading auth.py:
            // 178: return redirect(f"{FRONTEND_URL}/dashboard")

            // This confirms the bug. The frontend expects JSON but gets a redirect (HTML).

            await apiClient.get(`/auth/callback?code=${code}`);

            // After successful exchange, we can `setUser` or `checkAuth`.

          }
          await checkAuth();

          // ✅ Clear code from URL
          window.history.replaceState({}, document.title, '/dashboard');
        } catch (err) {
          console.error('Callback error:', err);
          callbackProcessed.current = false;
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
      if (response.authenticated) {
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
      if (response.auth_url) {
        window.location.href = response.auth_url;
      }
    } catch (err) {
      console.error('Login redirection failed:', err);
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

