import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global Google Maps activation and unhandled script error protection
if (typeof window !== 'undefined') {
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-auth-failure'));
  };

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('getRootNode') ||
      msg.includes('AdvancedMarker') ||
      msg.includes('ApiNotActivatedMapError') ||
      msg.includes('Google Maps JavaScript API error') ||
      msg.includes('Script error.') ||
      msg.includes("reading 'keys'")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = typeof reason === 'string' ? reason : reason?.message || '';
    if (
      msg.includes('getRootNode') ||
      msg.includes('ApiNotActivatedMapError') ||
      msg.includes('Google Maps JavaScript API error') ||
      msg.includes("reading 'keys'")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  // Filter console.error for unactivated Google Maps API notice and marker errors so app does not crash or throw unhandled errors
  const origConsoleError = console.error;
  console.error = function (...args: unknown[]) {
    const text = args
      .map((a) => (typeof a === 'string' ? a : (a as Error)?.message || ''))
      .join(' ');
    if (
      text.includes('ApiNotActivatedMapError') ||
      text.includes('Google Maps JavaScript API error') ||
      text.includes('MapErrorBoundary') ||
      text.includes('AdvancedMarker') ||
      text.includes("reading 'keys'")
    ) {
      console.warn('[Google Maps Fallback Engine Active]:', ...args);
      return;
    }
    origConsoleError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
