import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ProvedorDePreferencias } from './lib/preferencias.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProvedorDePreferencias>
      <App />
    </ProvedorDePreferencias>
  </StrictMode>,
)
