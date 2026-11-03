/**
 * Guarda as preferências de leitura e as aplica na página inteira. Envolve o App em main.tsx.
 * Tamanho e tema viram atributos no <html> (data-tamanho, data-tema), que o index.css usa
 * para trocar o tamanho da fonte e as cores. O nível de detalhe é lido pelos componentes.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { CHAVE_PREFERENCIAS, ContextoDePreferencias, carregarPreferencias, type Preferencias } from './preferencias'

export function ProvedorDePreferencias({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(carregarPreferencias)

  useEffect(() => {
    const html = document.documentElement
    html.dataset.tamanho = prefs.tamanho
    html.dataset.tema = prefs.tema
    try {
      localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(prefs))
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  }, [prefs])

  const mudar = (p: Partial<Preferencias>) => setPrefs((atual) => ({ ...atual, ...p }))
  return <ContextoDePreferencias.Provider value={{ prefs, mudar }}>{children}</ContextoDePreferencias.Provider>
}
