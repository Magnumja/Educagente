import { useEffect, useState } from 'react'

/**
 * Rotas com # (ex.: #/oficina/2): funcionam em qualquer servidor estático, o botão
 * voltar do navegador funciona e recarregar a página mantém a pessoa onde estava.
 */
function atual(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

export function useRota(): string[] {
  const [partes, setPartes] = useState(atual)
  useEffect(() => {
    const aoMudar = () => {
      setPartes(atual())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])
  return partes
}

export function href(caminho: string): string {
  return `#${caminho.startsWith('/') ? caminho : `/${caminho}`}`
}

export function navegar(caminho: string) {
  window.location.hash = href(caminho)
}
