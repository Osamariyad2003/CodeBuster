import React, { useEffect, useState, useCallback } from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FaBrain } from 'react-icons/fa';
import { getAiHealth } from '../../lib/apiClient';

const POLL_INTERVAL_MS = 45000;

const STATUS_META = {
    ok: { color: '#22c55e', label: 'AI online' },
    rate_limited: { color: '#f59e0b', label: 'AI rate-limited' },
    auth_error: { color: '#ef4444', label: 'AI key invalid' },
    provider_down: { color: '#ef4444', label: 'AI provider down' },
    network_error: { color: '#ef4444', label: 'AI unreachable' },
    unconfigured: { color: '#6b7280', label: 'AI not configured' },
    unknown: { color: '#6b7280', label: 'AI status unknown' },
    unknown_error: { color: '#ef4444', label: 'AI error' },
};

/**
 * Small status dot in the topbar showing whether the configured AI
 * provider (Gemini/Groq/OpenRouter/etc) is actually reachable right now.
 * Polls /github/ai/health rather than waiting for the user to hit a
 * generic "check the worker logs" error on a Preview/Enhance action.
 */
export default function AiHealthBadge() {
    const [health, setHealth] = useState(null);

    const refresh = useCallback(async () => {
        try {
            const res = await getAiHealth();
            setHealth(res);
        } catch (_) {
            // Health probe failing (e.g. logged out) shouldn't itself surface an error.
        }
    }, []);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [refresh]);

    if (!health) return null;

    const meta = STATUS_META[health.status] || STATUS_META.unknown;
    const providerLabel = health.active_provider
        ? `${health.active_provider}${health.active_model ? ` (${health.active_model})` : ''}`
        : 'no provider configured';

    const tooltipLines = [`Provider: ${providerLabel}`, `Status: ${meta.label}`];
    if (health.last_error_message) tooltipLines.push(`Last error: ${health.last_error_message}`);
    if (health.last_success_at) tooltipLines.push(`Last success: ${new Date(health.last_success_at).toLocaleTimeString()}`);

    return (
        <OverlayTrigger
            placement="bottom"
            overlay={
                <Tooltip>
                    <div style={{ textAlign: 'left' }}>
                        {tooltipLines.map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                </Tooltip>
            }
        >
            <div
                className="qd-topbar__action"
                style={{ position: 'relative', cursor: 'default' }}
                aria-label={`AI status: ${meta.label}`}
            >
                <FaBrain size={13} />
                <span
                    style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: meta.color,
                        border: '1.5px solid var(--surface-card, #161B27)',
                    }}
                />
            </div>
        </OverlayTrigger>
    );
}
