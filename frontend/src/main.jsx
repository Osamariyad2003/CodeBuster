import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './AuthContext.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import './App.css'

// Initialize theme immediately to prevent flash of unstyled content (FOUC)
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.classList.add(savedTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
