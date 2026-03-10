import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import LiveTournamentView from './components/LiveTournamentView';
import './index.css';
import { I18nProvider } from './lib/i18nContext';
import { AuthProvider } from './lib/authContext';

// Register Service Worker for push notifications
if ('serviceWorker' in navigator) {
  try {
    navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    }).then((registration) => {
      console.log('[SW] Service Worker registered:', registration.scope);
    }).catch((error) => {
      console.error('[SW] Service Worker registration failed:', error);
    });
  } catch (error) {
    console.error('[SW] Service Worker registration error:', error);
  }
}

const path = window.location.pathname;
const isLivePage = path.match(/^\/tournament\/[^/]+\/live$/);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      {isLivePage ? (
        <LiveTournamentView />
      ) : (
        <AuthProvider>
          <App />
        </AuthProvider>
      )}
    </I18nProvider>
  </StrictMode>
);
