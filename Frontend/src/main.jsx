import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { ToastProvider } from './context/ToastContext'
import { AnnouncementsProvider } from './context/AnnouncementsContext'
import { initSentry, Sentry } from './utils/sentry'
import { ErrorFallback } from './components/ErrorFallback'
import './index.css'
import './styles/utilities.css'
import App from './App.jsx'

// No-op unless VITE_SENTRY_DSN is set (dev/tests send nothing).
initSentry()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={ErrorFallback}>
      <BrowserRouter>
        <ToastProvider>
          <AnnouncementsProvider>
            <App />
          </AnnouncementsProvider>
        </ToastProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
