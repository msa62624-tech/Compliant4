import { useState, useEffect } from 'react';
import Pages from "@/pages/index.tsx";
import { Toaster } from "@/components/ui/toaster";
import Login from '@/components/Login.tsx';
import ErrorBoundary from '@/components/ErrorBoundary.tsx';
import * as auth from '@/auth';

function App(): JSX.Element {
  const [loggedIn, setLoggedIn] = useState<boolean>(!!auth.getToken());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let errorTimeout: ReturnType<typeof setTimeout> | undefined;
    let rejectionTimeout: ReturnType<typeof setTimeout> | undefined;
    
    // Global error handler for uncaught errors
    const handleError = (event: ErrorEvent): void => {
      console.error('Global error:', event.error);
      setError(`Error: ${event.error?.message || 'Unknown error occurred'}`);
      // Auto-clear after 5 seconds
      if (errorTimeout) clearTimeout(errorTimeout);
      errorTimeout = setTimeout(() => setError(null), 5000);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
      console.error('Unhandled rejection:', event.reason);
      setError(`Error: ${event.reason?.message || 'Unknown error occurred'}`);
      if (rejectionTimeout) clearTimeout(rejectionTimeout);
      rejectionTimeout = setTimeout(() => setError(null), 5000);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    // Keep logged-in state in sync with token changes (e.g., after 401 clears token)
    const handleAuthChange = (): void => setLoggedIn(!!auth.getToken());
    window.addEventListener('auth-changed', handleAuthChange);

    return () => {
      if (errorTimeout) clearTimeout(errorTimeout);
      if (rejectionTimeout) clearTimeout(rejectionTimeout);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('auth-changed', handleAuthChange);
    };
  }, []);

  const handleLogout = (): void => {
    auth.clearToken();
    setLoggedIn(false);
  };

  // Check if this is a public portal route (broker/sub/gc) - bypass login
  const isPublicPortal = ((): boolean => {
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
    <ErrorBoundary>
      <Login />
      <Toaster />
    </ErrorBoundary>
  );
  }

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  )
}

export default App;
