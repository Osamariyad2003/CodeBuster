import axios from 'axios';

const MAX_RETRIES = 3;

export const apiClient = axios.create({
    baseURL: '',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

apiClient.interceptors.request.use((config) => {
    const requestId = crypto.randomUUID?.() || Math.random().toString(36).substring(2);
    config.headers['X-Request-ID'] = requestId;
    return config;
});

apiClient.interceptors.response.use(
    (response) => {
        // Normalize successful response if it follows our API shape
        // or return as is
        return response.data;
    },
    async (error) => {
        const { config, response } = error;
        const isNetworkError = !response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error');

        // 1. Standardize Error Object
        let message = response?.data?.error || error.message || 'An unexpected error occurred';
        if (isNetworkError) {
            message = 'Backend unreachable. Is the server running? (e.g. port 5000)';
        }
        const standardError = {
            status: response?.status || 0,
            code: response?.data?.code || (isNetworkError ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR'),
            message,
            details: response?.data?.details || null,
            // Expose the full response body at a stable top-level field so
            // feature code can branch on backend-provided flags (e.g.
            // `comment_only_fix: true`, `idempotent: true`) without digging
            // through originalError.response.data.
            body: response?.data || null,
            originalError: error
        };

        // 2. Handle Rate Limiting (429)
        if (response?.status === 429) {
            const retryAfter = response.headers['retry-after'];
            const waitTime = retryAfter ? parseInt(retryAfter, 10) : 60;

            // Dispatch global event for UI (ToastProvider will listen)
            window.dispatchEvent(new CustomEvent('api-error', {
                detail: {
                    type: 'RATE_LIMIT',
                    message: `Rate limit exceeded. Please try again in ${waitTime} seconds.`,
                    waitTime
                }
            }));

            return Promise.reject(standardError);
        }

        // 3. Auto-Retry for Transient Errors (502, 503, 504)
        if (config && [502, 503, 504].includes(response?.status) && !config._retry) {
            config._retryCount = config._retryCount || 0;

            if (config._retryCount < MAX_RETRIES) {
                config._retryCount += 1;
                const backoff = Math.pow(2, config._retryCount) * 1000; // 1s, 2s, 4s...

                // Add jitter to prevent thundering herd
                const jitter = Math.random() * 200;
                await sleep(backoff + jitter);

                return apiClient(config);
            }
        }

        // 4. Auth: 401/403 — dispatch so app can redirect and show toast
        //    ("You're signed out or session expired").
        //
        //    Skipped when:
        //    - the caller opts out via config.skipAuthHandler = true
        //      (use this for feature endpoints that legitimately return 401
        //       for a non-session-expired reason — e.g. "no GitHub OAuth
        //       token stored for this user, please log in again")
        //    - the URL is /auth/user (probing the session itself; the AuthContext
        //      handles its own state without needing the global toast)
        const url = (config?.url || '').toString();
        const isSessionProbe = url.endsWith('/auth/user') || url.endsWith('/api/auth/user');
        const skipped = config?.skipAuthHandler || isSessionProbe;
        if (!skipped && (response?.status === 401 || response?.status === 403)) {
            window.dispatchEvent(new CustomEvent('auth-required', {
                detail: { status: response.status, message: standardError.message }
            }));
        }

        standardError.userMessage = standardError.message;
        return Promise.reject(standardError);
    }
);

// --- Review & Repo API helpers ---

export const getRepoReviews = (repoId, params = {}) => {
    const q = new URLSearchParams(params);
    return apiClient.get(`/api/repos/${repoId}/reviews?${q.toString()}`);
};

export const getLatestReview = (repoId) => {
    return apiClient.get(`/api/repos/${repoId}/latest-review`);
};

export const getReview = (reviewId) => {
    return apiClient.get(`/api/reviews/${reviewId}`);
};

export const getReviewIssues = (reviewId, params = {}) => {
    const q = new URLSearchParams(params);
    return apiClient.get(`/api/reviews/${reviewId}/issues?${q.toString()}`);
};

export const getScoreTrend = (repoId, days = 30) => {
    return apiClient.get(`/api/repos/${repoId}/score-trend?days=${days}`);
};

// --- Scan & Jobs (UI design contract) ---

/** POST /api/repos/:repoId/scan. Body: {} or { commit_sha }. Returns { success, message, job_id?, review_id?, inline?, idempotent? }. */
export const triggerScan = (repoId, body = {}) => {
    return apiClient.post(`/api/repos/${repoId}/scan`, body);
};

/** GET /api/jobs/:jobId. Returns job object or 404 { error }. */
export const getJob = (jobId) => {
    return apiClient.get(`/api/jobs/${jobId}`);
};

/** GET /api/reviews/:reviewId/canonical. Returns codebuster.commit_review payload. */
export const getReviewCanonical = (reviewId) => {
    return apiClient.get(`/api/reviews/${reviewId}/canonical`);
};

/** GET /api/jobs. Returns { jobs: [] } (or safe empty). */
export const getJobs = () => {
    return apiClient.get('/api/jobs').catch(() => ({ jobs: [] }));
};

// --- v1 FastAPI endpoints (new services) ---

export const getLatestReviewV1 = (repoId) => {
    return apiClient.get(`/api/v1/repos/${repoId}/reviews/latest`);
};

export const getReviewV1 = (reviewId) => {
    return apiClient.get(`/api/v1/reviews/${reviewId}`);
};

// --- Analytics endpoints (dashboard charts) ---

export const getIssuesByCategory = (repoId) =>
    apiClient.get(`/api/repos/${repoId}/analytics/issues-by-category`);

export const getRiskHeatmap = (repoId) =>
    apiClient.get(`/api/repos/${repoId}/analytics/risk-heatmap`);

export const getReviewActivity = (repoId, days = 30) =>
    apiClient.get(`/api/repos/${repoId}/analytics/review-activity?days=${days}`);

export const getSeverityTrend = (repoId, days = 30) =>
    apiClient.get(`/api/repos/${repoId}/analytics/severity-trend?days=${days}`);

// --- Feedback quality insights ---

export const getFeedbackStats = ({ repoId, days = 30 } = {}) => {
    const q = new URLSearchParams({ days });
    if (repoId) q.set('repo_id', repoId);
    return apiClient.get(`/api/feedback/stats?${q.toString()}`);
};

// --- AI provider health ---

export const getAiHealth = () =>
    apiClient.get('/github/ai/health', { skipAuthHandler: true });

