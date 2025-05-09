import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from 'react-oidc-context';
import App from './App';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';

// Add console log for debugging
console.log('Main.tsx: Starting application');

// OIDC auth configuration
const oidcConfig = {
  authority: 'https://live.fastn.ai/auth/realms/fastn',
  client_id: 'fastn-app',
  redirect_uri: window.location.origin,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
};

// Create a wrapper component that handles authentication
const AuthWrapper = () => {
  const auth = useAuth();

  // Show a loading indicator while auth state is being determined
  if (auth.isLoading) {
    return (<></>
      // <div className="flex items-center justify-center h-screen">
      //   <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent align-[-0.125em]"></div>
      //   <p className="ml-3 text-indigo-600">Loading authentication...</p>
      // </div>
    );
  }

  // If not authenticated, redirect to Keycloak
  if (!auth.isAuthenticated) {
    console.log('User not authenticated, redirecting to Keycloak...');
    auth.signinRedirect();
    return (
      <></>
      // <div className="flex items-center justify-center h-screen">
      //   <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent align-[-0.125em]"></div>
      //   <p className="ml-3 text-indigo-600">Redirecting to login...</p>
      // </div>
    );
  }

  // Only render the app if authenticated
  return <App />;
};

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <AuthProvider {...oidcConfig}>
          <AuthWrapper />
        </AuthProvider>
      </ErrorBoundary>
    </StrictMode>
  );
} else {
  console.error('Could not find root element to mount React app');
}
