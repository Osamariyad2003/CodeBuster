import { useState, useEffect, useCallback, useRef } from 'react';
import { useMonitoring } from '../contexts/MonitoringContext';

export const usePolling = (fetchFn, { intervalMs, enabled = true, key = 'default' } = {}) => {
    const { isPollingEnabled, pollingInterval, wsConnected } = useMonitoring();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const intervalRef = useRef(null);

    // Final interval value (local override or global)
    const activeInterval = intervalMs || pollingInterval;
    // Should we actually poll? (local enabled && global enabled && WS not connected)
    const shouldPoll = enabled && isPollingEnabled && !wsConnected;

    const triggerFetch = useCallback(async (isManual = false) => {
        if (isManual) setLoading(true);
        try {
            const result = await fetchFn();
            setData(result);
            setLastUpdated(new Date());
            setError(null);
        } catch (err) {
            setError(err.userMessage || 'Failed to sync data');
        } finally {
            if (isManual) setLoading(false);
        }
    }, [fetchFn]);

    useEffect(() => {
        if (shouldPoll) {
            triggerFetch(); // Initial fetch when polling becomes active
            intervalRef.current = setInterval(() => triggerFetch(), activeInterval);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [shouldPoll, activeInterval, triggerFetch]);

    return {
        data,
        loading,
        error,
        lastUpdated,
        refresh: () => triggerFetch(true),
        refetch: () => triggerFetch(true), // Support both names
        isPolling: shouldPoll,
        usingWs: wsConnected
    };
};
