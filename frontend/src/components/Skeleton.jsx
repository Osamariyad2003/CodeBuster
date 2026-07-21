import React from 'react';

const Skeleton = ({ className, width, height, circle }) => {
  const style = {
    width: width || '100%',
    height: height || '20px',
    borderRadius: circle ? '50%' : '6px',
    backgroundColor: 'var(--surface-card-elevated, #2d2d2d)',
    background: 'linear-gradient(90deg, var(--border-subtle, #30363d) 25%, var(--border-default, #424a53) 50%, var(--border-subtle, #30363d) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite linear',
    display: 'inline-block'
  };

  return (
    <div className={`skeleton-loader ${className || ''}`} style={style}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
};

export const SkeletonTable = ({ rows = 5, columns = 5 }) => {
  return (
    <div className="skeleton-table">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="d-flex gap-2 mb-2">
          {[...Array(columns)].map((_, j) => (
            <Skeleton key={j} height="30px" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const SkeletonDetail = () => {
  return (
    <div className="skeleton-detail">
      <Skeleton height="40px" width="60%" className="mb-4" />
      <div className="row">
        <div className="col-md-6 mb-3">
          <Skeleton height="20px" width="40%" className="mb-2" />
          <Skeleton height="30px" width="100%" />
        </div>
        <div className="col-md-6 mb-3">
          <Skeleton height="20px" width="40%" className="mb-2" />
          <Skeleton height="30px" width="100%" />
        </div>
      </div>
      <Skeleton height="150px" width="100%" className="mt-4" />
    </div>
  );
};

export default Skeleton;
