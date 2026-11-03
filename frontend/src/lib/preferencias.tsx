import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Ajustes de leitura, para a mesma oficina servir a adolescentes e adultos:
 * tamanho do texto, tema e quanto detalhe técnico aparece nas explicações.
 */
export type Tamanho = 'normal' | 'grande' | 'enorme'
export type Tema = 'claro' | 'escuro'
export type Detalhe = 'essencial' | 'tecnico'

interface Preferencias {
  tamanho: Tamanho
  tema: Tema
  detalhe: Detalhe
}

const PADRAO: Preferencias = { tamanho: 'normal', tema: 'claro', detalhe: 'essencial' }
const CHAVE = 'educagente:preferencias'

function carregar(): Preferencias {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Partial<Preferencias>
    return { ...PADRAO, ...salvo }
  } catch {
    return PADRAO
  }
}

const Contexto = createContext<{ prefs: Preferencias; mudar: (p: Partial<Preferencias>) => void }>({
  prefs: PADRAO,
  mudar: () => {},
})

export function ProvedorDePreferencias({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(carregar)

  useEffect(() => {
    const html = document.documentElement
    html.dataset.tamanho = prefs.tamanho
    html.dataset.tema = prefs.tema
    try {
      localStorage.setItem(CHAVE, JSON.stringify(prefs))
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  }, [prefs])

  return <Contexto.Provider value={{ prefs, mudar: (p) => setPrefs((a) => ({ ...a, ...p })) }}>{children}</Contexto.Provider>
}

export const usePreferencias = () => useContext(Contexto)
