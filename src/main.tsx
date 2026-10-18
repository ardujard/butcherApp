import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// All stock history lives only in this browser's IndexedDB. Asking for
// persistent storage keeps the browser from clearing it under storage
// pressure; it's a best-effort request, so a refusal changes nothing.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
