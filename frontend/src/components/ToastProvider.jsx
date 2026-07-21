import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, variant = 'info') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, variant }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
    }, []);

    // Listen for global API errors (like 429 Rate Limits)
    useEffect(() => {
        const handleApiError = (event) => {
            const { message, type } = event.detail;
            if (type === 'RATE_LIMIT') {
                showToast(message, 'warning');
            } else {
                showToast(message, 'danger');
            }
        };

        window.addEventListener('api-error', handleApiError);
        return () => window.removeEventListener('api-error', handleApiError);
    }, [showToast]);

    const removeToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
                {toasts.map((toast) => (
                    <Toast key={toast.id} bg={toast.variant} onClose={() => removeToast(toast.id)} delay={5000} autohide>
                        <Toast.Header>
                            <strong className="me-auto">Notification</strong>
                        </Toast.Header>
                        <Toast.Body className={['success', 'danger', 'primary', 'info'].includes(toast.variant) ? 'text-white' : ''}>
                            {toast.message}
                        </Toast.Body>
                    </Toast>
                ))}
            </ToastContainer>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};
