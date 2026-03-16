
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Suppress Recharts defaultProps warnings in React 18.3+ and Supabase refresh token errors
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string') {
    if (args[0].includes('defaultProps')) return;
    if (args[0].includes('Invalid Refresh Token')) return;
  }
  if (args[0] && typeof args[0].message === 'string' && args[0].message.includes('Invalid Refresh Token')) {
    return;
  }
  originalConsoleError(...args);
};

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('Invalid Refresh Token')) {
    event.preventDefault();
    // Clear local storage to force re-login
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('protrack') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    window.location.reload();
  }
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
