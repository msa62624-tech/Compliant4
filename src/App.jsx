import { useState, useEffect } from 'react'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import Login from '@/components/Login.jsx'
import auth from '@/auth.js'

function App() {
  const [loggedIn, setLoggedIn] = useState(!!auth.getToken());
  const [error, setError] = useState(null);

  useEffect(() => {
    let errorTimeout;
    let rejectionTimeout;
    
    // Global error handler for uncaught errors
    const handleError = (event) => {
      console.error('Global error:', event.error);
      setError(`Error: ${event.error?.message || 'Unknown error occurred'}`);
      // Auto-clear after 5 seconds
      clearTimeout(errorTimeout);
      errorTimeout = setTimeout(() => setError(null), 5000);
    };

    const handleUnhandledRejection = (event) => {
      console.error('Unhandled rejection:', event.reason);
      setError(`Error: ${event.reason?.message || 'Unknown error occurred'}`);
      clearTimeout(rejectionTimeout);
      rejectionTimeout = setTimeout(() => setError(null), 5000);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    // Keep logged-in state in sync with token changes (e.g., after 401 clears token)
    const handleAuthChange = () => setLoggedIn(!!auth.getToken());
    window.addEventListener('auth-changed', handleAuthChange);

    return () => {
      clearTimeout(errorTimeout);
      clearTimeout(rejectionTimeout);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('auth-changed', handleAuthChange);
    };
  }, []);

  const handleLogin = () => setLoggedIn(true);
  const handleLogout = () => {
    auth.clearToken();
    setLoggedIn(false);
  };

  // Check if this is a public portal route (broker/sub/gc) - bypass login
  const isPublicPortal = (() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    return path.startsWith('/broker-') || 
           path.startsWith('/subcontractor-') || 
           path.startsWith('/gc-dashboard') || 
           path.startsWith('/gc-project') ||
           path.startsWith('/gc-login') ||
           path.startsWith('/reset-password');
  })();

  if (!loggedIn && !isPublicPortal) {
    return (
    <>
      <Login onLogin={handleLogin} />
      <Toaster />
    </>
  );
  }

  return (
    <>
      {error && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          backgroundColor: '#f87171',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '4px',
          zIndex: 9999,
          pointerEvents: 'none'
        }}>
          {error}
        </div>
      )}
      <Pages onLogout={handleLogout} />
      <Toaster />
    </>
  )
}

export default App