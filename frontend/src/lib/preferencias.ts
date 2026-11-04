/**
 * Ajustes de leitura, para a mesma oficina servir a adolescentes e adultos:
 * tamanho do texto e tema.
 *
 * Aqui ficam os tipos, o valor padrão, a leitura do localStorage e o hook usePreferencias().
 * O componente que guarda o estado e aplica no <html> é o ProvedorDePreferencias.
 */
import { createContext, useContext } from 'react'

export type Tamanho = 'normal' | 'grande' | 'enorme'
export type Tema = 'claro' | 'escuro'

export interface Preferencias {
  tamanho: Tamanho
  tema: Tema
}

export const PADRAO: Preferencias = { tamanho: 'normal', tema: 'claro' }
export const CHAVE_PREFERENCIAS = 'educagente:preferencias'

/** Lê o que a pessoa escolheu da última vez; o que faltar (ou vier quebrado) volta ao padrão. */
export function carregarPreferencias(): Preferencias {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS) ?? '{}') as Partial<Preferencias>
    return { ...PADRAO, ...salvo }
  } catch {
    return PADRAO
  }
}

interface ValorDoContexto {
  prefs: Preferencias
  mudar: (p: Partial<Preferencias>) => void
}

export const ContextoDePreferencias = createContext<ValorDoContexto>({ prefs: PADRAO, mudar: () => {} })

/** Em qualquer componente: const { prefs, mudar } = usePreferencias(). */
export const usePreferencias = () => useContext(ContextoDePreferencias)
