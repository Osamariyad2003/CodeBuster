import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error.toString() };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div 
          className="d-flex align-items-center justify-content-center vh-100" 
          style={{ 
            background: 'var(--background-color, #0f172a)', 
            color: 'var(--text-color, #fff)' 
          }}
        >
          <div 
            className="text-center p-5" 
            style={{ 
              background: 'var(--card-background-color, rgba(255,255,255,0.1))', 
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--card-border-color, rgba(255,255,255,0.1))',
              borderRadius: 24,
              maxWidth: 400,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <h2 className="mb-3" style={{ fontWeight: 700 }}>Something went wrong</h2>
            <p className="text-muted mb-4">The application encountered an unexpected error.</p>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-danger small mb-4" style={{ wordBreak: 'break-word', fontSize: '0.75rem' }}>
                {this.state.errorMessage}
              </p>
            )}
            <button 
              className="btn btn-primary px-4 py-2" 
              onClick={() => window.location.reload()}
              style={{ 
                background: 'var(--primary-gradient, #6366f1)', 
                border: 'none',
                borderRadius: 12,
                fontWeight: 600
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}