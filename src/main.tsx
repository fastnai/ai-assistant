import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
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

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <AuthProvider {...oidcConfig}>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </StrictMode>
  );
} else {
  console.error('Could not find root element to mount React app');
}
