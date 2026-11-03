/**
 * Rotas com # (ex.: #/oficina/2): funcionam em qualquer servidor estático, o botão
 * voltar do navegador funciona e recarregar a página mantém a pessoa onde estava.
 * O App lê as partes da rota com useRota() e escolhe a página.
 */
import { useEffect, useState } from 'react'

/** "#/oficina/2" vira ['oficina', '2']. */
function partesDaRota(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

/** Partes da rota atual; atualiza (e volta ao topo) sempre que o # muda. */
export function useRota(): string[] {
  const [partes, setPartes] = useState(partesDaRota)
  useEffect(() => {
    const aoMudar = () => {
      setPartes(partesDaRota())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])
  return partes
}

/** Monta o href de um link interno: href('/oficina/2') devolve '#/oficina/2'. */
export function href(caminho: string): string {
  return `#${caminho.startsWith('/') ? caminho : `/${caminho}`}`
}

/** Navega por código (depois de entrar, salvar etc.); dispara o hashchange que o useRota escuta. */
export function navegar(caminho: string) {
  window.location.hash = href(caminho)
}
