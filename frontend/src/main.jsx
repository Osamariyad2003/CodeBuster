import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './AuthContext.jsx'
import { ThemeProvider } from './ThemeContext.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import './App.css'

// Initialize theme immediately to prevent flash of unstyled content (FOUC)
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.classList.remove(savedTheme === 'dark' ? 'light' : 'dark');
document.documentElement.classList.add(savedTheme);
document.documentElement.setAttribute('data-bs-theme', savedTheme);
document.documentElement.setAttribute('data-theme', savedTheme);
document.documentElement.style.colorScheme = savedTheme;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
