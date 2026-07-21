import React from 'react';
import Skeleton from './Skeleton';

/**
 * DataLoader Component
 * Handles Loading, Error, Empty, and Success states gracefully.
 */
const DataLoader = ({
    isLoading,
    error,
    isEmpty,
    onRetry,
    skeletonCount = 3,
    skeletonHeight = '100px',
    emptyMessage = "No data found.",
    children
}) => {
    // 1. Error State
    if (error) {
        return (
            <div className="p-5 text-center my-4 border border-danger border-opacity-25 rounded-4 bg-danger bg-opacity-10">
                <div className="mb-3 fs-1">⚠️</div>
                <h4 className="text-danger mb-2">Failed to load data</h4>
                <p className="text-muted mb-4">{error.message || "An unexpected error occurred."}</p>
                {onRetry && (
                    <button
                        className="btn btn-outline-danger px-4 rounded-3"
                        onClick={onRetry}
                        aria-label="Retry loading data"
                    >
                        Retry
                    </button>
                )}
            </div>
        );
    }

    // 2. Loading State
    if (isLoading) {
        return (
            <div className="data-loader-skeleton">
                {[...Array(skeletonCount)].map((_, i) => (
                    <Skeleton key={i} height={skeletonHeight} className="mb-3" />
                ))}
            </div>
        );
    }

    // 3. Empty State
    if (isEmpty) {
        return (
            <div className="p-5 text-center my-4 border border-dashed border-secondary border-opacity-50 rounded-4">
                <div className="mb-3 fs-1">📂</div>
                <h4 className="text-muted mb-2">Empty State</h4>
                <p className="text-muted-50 mb-0">{emptyMessage}</p>
            </div>
        );
    }

    // 4. Success State
    return <>{children}</>;
};

export default DataLoader;
