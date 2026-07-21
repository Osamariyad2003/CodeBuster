import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const MonitoringContext = createContext();

export const MonitoringProvider = ({ children }) => {
    const [isPollingEnabled, setIsPollingEnabled] = useState(() => {
        const saved = localStorage.getItem('monitoring_polling_enabled');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const [pollingInterval, setPollingInterval] = useState(() => {
        const saved = localStorage.getItem('monitoring_polling_interval');
        return saved !== null ? JSON.parse(saved) : 10000;
    });

    const [wsConnected, setWsConnected] = useState(false);
    const wsRef = useRef(null);

    useEffect(() => {
        localStorage.setItem('monitoring_polling_enabled', JSON.stringify(isPollingEnabled));
    }, [isPollingEnabled]);

    useEffect(() => {
        localStorage.setItem('monitoring_polling_interval', JSON.stringify(pollingInterval));
    }, [pollingInterval]);

    useEffect(() => {
        const enableWs = import.meta.env.VITE_ENABLE_WEBSOCKET === 'true';
        if (!enableWs) return;

        const connect = () => {
            const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5000/ws/monitoring';
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('Monitoring WebSocket connected');
                setWsConnected(true);
            };

            ws.onclose = () => {
                console.log('Monitoring WebSocket disconnected');
                setWsConnected(false);
                // Reconnect after 5 seconds
                setTimeout(connect, 5000);
            };

            ws.onerror = (err) => {
                console.error('Monitoring WebSocket error:', err);
                ws.close();
            };

            wsRef.current = ws;
        };

        connect();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    const value = {
        isPollingEnabled,
        setIsPollingEnabled,
        pollingInterval,
        setPollingInterval,
        wsConnected
    };

    return (
        <MonitoringContext.Provider value={value}>
            {children}
        </MonitoringContext.Provider>
    );
};

export const useMonitoring = () => {
    const context = useContext(MonitoringContext);
    if (!context) {
        throw new Error('useMonitoring must be used within a MonitoringProvider');
    }
    return context;
};
