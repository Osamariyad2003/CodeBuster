import React, { useId } from 'react';

/**
 * Ultra-Minimal Flat Cyber-Rabbit Icon for CodeBuster.
 * Features a clean 2D minimalist silhouette with safety orange gradient,
 * inner ear depth, and cyber-mint '< >' code scanner eyes.
 */
export const RabbitIcon = ({ size = 28, glow = true, className = '', style = {} }) => {
  const rawId = useId();
  const id = rawId.replace(/:/g, '_');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        flexShrink: 0,
        display: 'inline-block',
        verticalAlign: 'middle',
        transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), filter 0.25s ease',
        ...style,
      }}
    >
      <defs>
        {/* Silhouette Body Gradient */}
        <linearGradient id={`${id}-body`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF7A30" />
          <stop offset="100%" stopColor="#FF570A" />
        </linearGradient>

        {/* Cyber-Mint Scanner Gradient */}
        <linearGradient id={`${id}-mint`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#25E2A8" />
          <stop offset="100%" stopColor="#00FFAA" />
        </linearGradient>

        {/* Filter Effects */}
        {glow && (
          <>
            <filter id={`${id}-eyeGlow`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#25E2A8" floodOpacity="0.85" />
            </filter>
            <filter id={`${id}-outerGlow`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#FF570A" floodOpacity="0.4" />
            </filter>
          </>
        )}
      </defs>

      <g filter={glow ? `url(#${id}-outerGlow)` : undefined}>
        {/* Rabbit Head Silhouette */}
        <path
          d="M 9.5 2.5 C 10.8 2.5 12 3.8 12.5 6 L 14 13 C 14.6 12.4 15.3 12 16 12 C 16.7 12 17.4 12.4 18 13 L 19.5 6 C 20 3.8 21.2 2.5 22.5 2.5 C 24 2.5 25.2 3.9 24.8 6.5 L 23.5 14.5 C 25.8 16.2 27 19 27 22 C 27 26.2 23.5 29.5 16 29.5 C 8.5 29.5 5 26.2 5 22 C 5 19 6.2 16.2 8.5 14.5 L 7.2 6.5 C 6.8 3.9 8 2.5 9.5 2.5 Z"
          fill={`url(#${id}-body)`}
        />

        {/* Inner Ear Depth */}
        <path
          d="M 9.5 5.5 C 10.2 5.5 10.8 6.2 11 7.2 L 12.2 11.8 C 11.5 11.2 10.5 10.8 9.5 10.8 C 8.5 10.8 7.8 11.2 7.2 11.8 L 8 7.2 C 8.2 6.2 8.8 5.5 9.5 5.5 Z"
          fill="rgba(0, 0, 0, 0.22)"
        />
        <path
          d="M 22.5 5.5 C 23.2 5.5 23.8 6.2 24 7.2 L 24.8 11.8 C 24.2 11.2 23.5 10.8 22.5 10.8 C 21.5 10.8 20.5 11.2 19.8 11.8 L 21 7.2 C 21.2 6.2 21.8 5.5 22.5 5.5 Z"
          fill="rgba(0, 0, 0, 0.22)"
        />

        {/* Cyber-Mint Code Eyes '< >' */}
        <path
          d="M 13 18.5 L 10.5 20.2 L 13 22"
          stroke={`url(#${id}-mint)`}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={glow ? `url(#${id}-eyeGlow)` : undefined}
        />
        <path
          d="M 19 18.5 L 21.5 20.2 L 19 22"
          stroke={`url(#${id}-mint)`}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={glow ? `url(#${id}-eyeGlow)` : undefined}
        />

        {/* Center Scanner Core / Nose Node */}
        <circle
          cx="16"
          cy="24.5"
          r="1"
          fill="#25E2A8"
          filter={glow ? `url(#${id}-eyeGlow)` : undefined}
        />
      </g>
    </svg>
  );
};

/**
 * Complete Brand Logo with Origami Icon, Gradient Wordmark, and AST Badge.
 */
export const BrandLogo = ({
  size = 32,
  badge = 'AST AI',
  subtitle = null,
  collapsed = false,
  className = '',
  textClass = '',
  animated = true,
  onClick = undefined,
}) => {
  return (
    <div
      className={`cb-brand-logo d-inline-flex align-items-center gap-2 ${className}`}
      onClick={onClick}
      style={{
        userSelect: 'none',
        cursor: onClick ? 'pointer' : 'default',
        lineHeight: 1,
      }}
    >
      {/* Icon Emblem Container */}
      <div
        className="cb-brand-icon-box"
        style={{
          width: size + 8,
          height: size + 8,
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(255, 87, 10, 0.22) 0%, rgba(255, 122, 48, 0.08) 100%)',
          border: '1px solid rgba(255, 87, 10, 0.35)',
          boxShadow: '0 4px 16px rgba(255, 87, 10, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: animated ? 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease' : 'none',
        }}
      >
        <RabbitIcon size={size} />
      </div>

      {/* Typography & Subtitle */}
      {!collapsed && (
        <div className="d-flex flex-column justify-content-center" style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-1.5 flex-nowrap">
            <span
              className={`cb-brand-text ${textClass}`}
              style={{
                fontFamily: 'var(--font-display, "Syne", sans-serif)',
                fontSize: size >= 32 ? '1.3rem' : '1.15rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary, #FFFFFF)',
                whiteSpace: 'nowrap',
              }}
            >
              Code
              <span
                style={{
                  background: 'linear-gradient(135deg, #FF8A3D 0%, #FF570A 50%, #FF3D00 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Buster
              </span>
            </span>

            {badge && (
              <span
                className="cb-brand-badge"
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#25E2A8',
                  background: 'rgba(37, 226, 168, 0.12)',
                  border: '1px solid rgba(37, 226, 168, 0.32)',
                  padding: '1.5px 5.5px',
                  borderRadius: 5,
                  lineHeight: 1.2,
                  boxShadow: '0 0 10px rgba(37, 226, 168, 0.15)',
                  whiteSpace: 'nowrap',
                }}
              >
                {badge}
              </span>
            )}
          </div>

          {subtitle && (
            <span
              className="cb-brand-sub text-muted"
              style={{
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.02em',
                marginTop: 2,
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default BrandLogo;
