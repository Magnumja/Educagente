/**
 * Topo da tela de uma oficina: título, código de entrada, "Mostrar no projetor" (código em
 * tela cheia num <dialog>), copiar o link de entrada e abrir/fechar a oficina.
 */
import { useRef, useState } from 'react'
import { Copy, MonitorUp, X } from 'lucide-react'
import { Botao } from '@/components/ui'
import { api } from '@/lib/api'
import type { PropsDaParte } from './tipos'

export function CabecalhoDaOficina({ oficina, executar }: PropsDaParte) {
  const link = `${window.location.origin}${window.location.pathname}#/entrar/${oficina.codigo}`
  const [copiado, setCopiado] = useState(false)
  const dialogo = useRef<HTMLDialogElement>(null)

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* sem permissão: o link está visível no projetor */
    }
  }

  return (
    <header className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">{oficina.titulo}</h1>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <p>
          <span className="block text-sm text-tinta-2">Código para entrar</span>
          <span className="font-mono text-4xl font-bold tracking-[0.18em]">{oficina.codigo}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Botao variante="primario" onClick={() => dialogo.current?.showModal()}>
            <MonitorUp className="size-4" aria-hidden /> Mostrar no projetor
          </Botao>
          <Botao variante="secundario" onClick={copiarLink}>
            <Copy className="size-4" aria-hidden /> {copiado ? 'Link copiado' : 'Copiar link de entrada'}
          </Botao>
          <Botao variante="secundario" onClick={() => executar(() => api.facilitador.atualizar(oficina.id, { aberta: !oficina.aberta }))}>
            {oficina.aberta ? 'Fechar para novos participantes' : 'Reabrir a oficina'}
          </Botao>
        </div>
      </div>
      <p className="text-sm text-tinta-2">
        {oficina.aberta ? 'Aberta: novas pessoas podem entrar.' : 'Fechada: ninguém novo entra; quem já entrou continua.'}
      </p>

      {/* <dialog> nativo com showModal(): prende o foco e fecha com Esc sem código extra. */}
      <dialog
        ref={dialogo}
        aria-label="Código da oficina em tela cheia"
        className="m-0 h-dvh max-h-none w-dvw max-w-none bg-fundo p-0 text-tinta backdrop:bg-tinta/60"
      >
        <div className="flex h-full flex-col items-center justify-center gap-8 p-8 text-center">
          <p className="text-3xl font-semibold">Entre em</p>
          <p className="break-all font-mono text-2xl text-tinta-2">{window.location.host}</p>
          <p className="text-3xl font-semibold">e digite o código</p>
          <p className="font-mono text-[clamp(4rem,14vw,10rem)] font-bold leading-none tracking-[0.12em]">{oficina.codigo}</p>
          <Botao variante="secundario" onClick={() => dialogo.current?.close()} autoFocus>
            <X className="size-4" aria-hidden /> Fechar
          </Botao>
        </div>
      </dialog>
    </header>
  )
}
