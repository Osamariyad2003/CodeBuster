import React from 'react';

const LiveStatusDot = ({ status = 'idle', size = 10, className = '' }) => {
    const getColor = (s) => {
        switch (s) {
            case 'active': return '#198754';
            case 'busy': return '#0d6efd';
            case 'error': return '#dc3545';
            case 'warning': return '#ffc107';
            default: return '#adb5bd';
        }
    };

    const color = getColor(status);

    return (
        <div className={`d-inline-flex position-relative ${className}`} style={{ width: size, height: size }}>
            <span
                className="position-absolute top-0 start-0 w-100 h-100 rounded-circle opacity-75 animate-ping"
                style={{ backgroundColor: color, animation: status === 'active' || status === 'busy' ? 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' : 'none' }}
            ></span>
            <span
                className="position-relative d-inline-block rounded-circle w-100 h-100"
                style={{ backgroundColor: color }}
            ></span>
            <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
        </div>
    );
};

export default LiveStatusDot;
