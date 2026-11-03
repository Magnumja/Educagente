import { useEffect, useId, useRef, useState } from 'react'
import { BookOpenCheck, SlidersHorizontal, X } from 'lucide-react'
import { Segmentado, botaoCls, larguraCls } from '@/components/ui'
import { usePreferencias, type Detalhe, type Tamanho, type Tema } from '@/lib/preferencias'
import { href } from '@/lib/rota'
import { cn } from '@/lib/utils'

export function Cabecalho({ rotaAtual }: { rotaAtual: string }) {
  const [aberto, setAberto] = useState(false)
  const painelId = useId()
  const botaoRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false)
        botaoRef.current?.focus()
      }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  return (
    <header className="border-b bg-superficie">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-p focus:bg-superficie focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      <div className={cn(larguraCls, 'flex flex-wrap items-center gap-x-4 gap-y-2 py-3')}>
        <a href={href('/')} className="mr-auto flex items-center gap-2 rounded-p font-bold tracking-tight">
          <BookOpenCheck className="size-6 text-acao" aria-hidden />
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
          <button
            ref={botaoRef}
            type="button"
            aria-expanded={aberto}
            aria-controls={painelId}
            onClick={() => setAberto((a) => !a)}
            className={cn(botaoCls('secundario', 'p'), aberto && 'bg-superficie-2')}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            <span className="sm:hidden">Leitura</span>
            <span className="hidden sm:inline">Ajustes de leitura</span>
          </button>
        </nav>
      </div>
      {aberto && <PainelDeLeitura id={painelId} aoFechar={() => setAberto(false)} />}
    </header>
  )
}

function PainelDeLeitura({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const { prefs, mudar } = usePreferencias()
  return (
    <div id={id} role="region" aria-label="Ajustes de leitura" className="surgir border-t bg-superficie-2">
      <div className={cn(larguraCls, 'flex flex-wrap items-start gap-x-10 gap-y-5 py-5')}>
        <Segmentado<Tamanho>
          legenda="Tamanho do texto"
          compacto
          valor={prefs.tamanho}
          aoMudar={(tamanho) => mudar({ tamanho })}
          opcoes={[
            { valor: 'normal', rotulo: 'Normal' },
            { valor: 'grande', rotulo: 'Grande' },
            { valor: 'enorme', rotulo: 'Muito grande' },
          ]}
        />
        <Segmentado<Tema>
          legenda="Cores"
          compacto
          valor={prefs.tema}
          aoMudar={(tema) => mudar({ tema })}
          opcoes={[
            { valor: 'claro', rotulo: 'Fundo claro' },
            { valor: 'escuro', rotulo: 'Fundo escuro' },
          ]}
        />
        <div className="max-w-sm">
          <Segmentado<Detalhe>
            legenda="Explicações"
            compacto
            valor={prefs.detalhe}
            aoMudar={(detalhe) => mudar({ detalhe })}
            opcoes={[
              { valor: 'essencial', rotulo: 'O essencial' },
              { valor: 'tecnico', rotulo: 'Com detalhes técnicos' },
            ]}
          />
          <p className="mt-2 text-sm text-tinta-2">
            Com detalhes técnicos, você vê a similaridade de cada trecho e as instruções exatas enviadas à IA.
          </p>
        </div>
        <button type="button" onClick={aoFechar} className={cn(botaoCls('discreto', 'p'), 'ml-auto')}>
          <X className="size-4" aria-hidden /> Fechar
        </button>
      </div>
    </div>
  )
}
