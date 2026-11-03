/** Ponto de entrada: carrega o CSS, liga as preferências de leitura e desenha o App em #root. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ProvedorDePreferencias } from './lib/ProvedorDePreferencias.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProvedorDePreferencias>
      <App />
    </ProvedorDePreferencias>
  </StrictMode>,
)
