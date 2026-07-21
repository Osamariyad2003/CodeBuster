import { useRef, useCallback } from 'react';

const cacheStore = new Map();

export const useCache = (ttl = 60000) => {
    const getCacheKey = useCallback((path, params) => {
        return `${path}?${new URLSearchParams(params).toString()}`;
    }, []);

    const get = useCallback((key) => {
        const cached = cacheStore.get(key);
        if (cached && Date.now() - cached.timestamp < ttl) {
            return cached.data;
        }
        return null;
    }, [ttl]);

    const set = useCallback((key, data) => {
        cacheStore.set(key, { data, timestamp: Date.now() });
    }, []);

    const clear = useCallback(() => {
        cacheStore.clear();
    }, []);

    // LocalStorage helpers for persistent preferences (like filters)
    const persist = useCallback((key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('Failed to save to localStorage', e);
        }
    }, []);

    const retrieve = useCallback((key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }, []);

    return { get, set, clear, getCacheKey, persist, retrieve };
};
