import { useState, useEffect } from 'react';

export const useRealtime = (onMessage, enabled = import.meta.env.VITE_ENABLE_WEBSOCKET === 'true') => {
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!enabled) return;

        // Phase 2: Implement WebSocket connection
        console.log('Realtime WS enabled (Phase 2 Stub)');

        // Fallback: This is a placeholder for WS logic
        // const ws = new WebSocket(import.meta.env.VITE_WS_URL);
        // ws.onopen = () => setConnected(true);
        // ws.onmessage = (e) => onMessage(JSON.parse(e.data));
        // ws.onclose = () => setConnected(false);

        // return () => ws.close();
    }, [enabled, onMessage]);

    return { connected };
};
