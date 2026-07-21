import React from 'react';
import { Pagination as BSPagination } from 'react-bootstrap';

export const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    return (
        <BSPagination className="justify-content-center mt-4">
            <BSPagination.First onClick={() => onPageChange(1)} disabled={currentPage === 1} />
            <BSPagination.Prev onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} />

            {/* Simple MVP pagination: just show current page context */}
            {currentPage > 2 && <BSPagination.Ellipsis />}
            {currentPage > 1 && (
                <BSPagination.Item onClick={() => onPageChange(currentPage - 1)}>
                    {currentPage - 1}
                </BSPagination.Item>
            )}
            <BSPagination.Item active>{currentPage}</BSPagination.Item>
            {currentPage < totalPages && (
                <BSPagination.Item onClick={() => onPageChange(currentPage + 1)}>
                    {currentPage + 1}
                </BSPagination.Item>
            )}
            {currentPage < totalPages - 1 && <BSPagination.Ellipsis />}

            <BSPagination.Next onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} />
            <BSPagination.Last onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} />
        </BSPagination>
    );
};
