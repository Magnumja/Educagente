/**
 * Cabeçalho de todas as páginas: logo (link para o início), link "Como a IA usa fontes" e a
 * engrenagem que abre os ajustes de leitura em ícones (modo noturno e tamanho do texto).
 */
import { useEffect, useId, useRef, useState } from 'react'
import { Moon, Settings } from 'lucide-react'
import { botaoCls, larguraCls } from '@/components/classes'
import { usePreferencias, type Tamanho } from '@/lib/preferencias'
import { href } from '@/lib/rota'
import { cn } from '@/lib/utils'

export function Cabecalho({ rotaAtual }: { rotaAtual: string }) {
  const [aberto, setAberto] = useState(false)
  const painelId = useId()
  const botaoRef = useRef<HTMLButtonElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)

  // Esc fecha o painel e devolve o foco à engrenagem (acessibilidade de teclado); clicar fora também fecha.
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false)
        botaoRef.current?.focus()
      }
    }
    const aoClicar = (e: PointerEvent) => {
      if (!areaRef.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)
    document.addEventListener('pointerdown', aoClicar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('pointerdown', aoClicar)
    }
  }, [aberto])

  return (
    <header className="border-b bg-superficie">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-p focus:bg-superficie focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      <div className={cn(larguraCls, 'flex flex-wrap items-center gap-x-4 gap-y-2 py-3')}>
        <a href={href('/')} className="mr-auto flex items-center gap-2 rounded-p font-bold tracking-tight">
          {/* Só o símbolo da logo: o nome vai em texto, com o contraste do tema (claro ou escuro). */}
          <img src="/logo-educagente-icone.png" alt="" className="size-8 shrink-0" />
          <span className="text-lg">Educagente</span>
        </a>
        <nav aria-label="Principal" className="flex items-center gap-1">
          <a
            href={href('/como-funciona')}
            aria-current={rotaAtual === 'como-funciona' ? 'page' : undefined}
            className={cn(botaoCls('discreto', 'p'), rotaAtual === 'como-funciona' && 'bg-acao-suave')}
          >
            <span className="sm:hidden">Como funciona</span>
            <span className="hidden sm:inline">Como a IA usa fontes</span>
          </a>
          <div ref={areaRef} className="relative">
            <button
              ref={botaoRef}
              type="button"
              aria-label="Ajustes de leitura"
              title="Ajustes de leitura"
              aria-expanded={aberto}
              aria-controls={painelId}
              onClick={() => setAberto((a) => !a)}
              className={cn(botaoCls('secundario', 'p'), 'size-11 p-0', aberto && 'bg-superficie-2')}
            >
              <Settings className="size-5" aria-hidden />
            </button>
            {aberto && <PainelDeLeitura id={painelId} />}
          </div>
        </nav>
      </div>
    </header>
  )
}

const TAMANHOS: { valor: Tamanho; rotulo: string; letra: string }[] = [
  { valor: 'normal', rotulo: 'Texto normal', letra: 'text-sm' },
  { valor: 'grande', rotulo: 'Texto grande', letra: 'text-lg' },
  { valor: 'enorme', rotulo: 'Texto muito grande', letra: 'text-2xl' },
]

const iconeCls =
  'grid size-11 place-items-center rounded-p text-tinta-2 transition-colors hover:bg-superficie-2 aria-pressed:bg-acao-suave aria-pressed:text-acao'

/** Painel que abre abaixo da engrenagem: só ícones, cada um com nome para leitor de tela e dica ao passar o mouse. */
function PainelDeLeitura({ id }: { id: string }) {
  const { prefs, mudar } = usePreferencias()
  const noturno = prefs.tema === 'escuro'
  return (
    <div
      id={id}
      role="group"
      aria-label="Ajustes de leitura"
      className="surgir absolute right-0 top-full z-40 mt-2 flex items-center gap-1 rounded-caixa border bg-superficie p-2 shadow-caixa"
    >
      <button
        type="button"
        aria-label="Modo noturno"
        title="Modo noturno"
        aria-pressed={noturno}
        onClick={() => mudar({ tema: noturno ? 'claro' : 'escuro' })}
        className={iconeCls}
      >
        <Moon className="size-5" aria-hidden />
      </button>
      <span className="mx-1 h-7 w-px bg-linha" aria-hidden />
      <div role="group" aria-label="Tamanho do texto" className="flex items-center gap-1">
        {TAMANHOS.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-label={o.rotulo}
            title={o.rotulo}
            aria-pressed={prefs.tamanho === o.valor}
            onClick={() => mudar({ tamanho: o.valor })}
            className={cn(iconeCls, 'font-bold', o.letra)}
          >
            A
          </button>
        ))}
      </div>
    </div>
  )
}
