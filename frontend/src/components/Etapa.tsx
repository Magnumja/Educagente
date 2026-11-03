/**
 * Peças comuns às cinco etapas da oficina (paginas/oficina/*): o cabeçalho de abertura
 * e a barra "Avançar" no fim. Ficam aqui, e não em paginas/Oficina.tsx, para as etapas
 * não importarem de volta o arquivo que as importa (import circular).
 */
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { botaoCls } from '@/components/classes'
import type { Estado } from '@/lib/api'
import { ETAPAS } from '@/lib/etapas'
import { href } from '@/lib/rota'
import { cn } from '@/lib/utils'

/** O que toda etapa recebe da página Oficina: o estado do participante e como buscá-lo de novo. */
export interface PropsEtapa {
  estado: Estado
  /** Busca GET /eu de novo; cada etapa chama depois de uma ação que muda o estado no servidor. */
  recarregar: () => Promise<void>
}

/** Abertura da etapa, compacta: ícone, título e uma frase. O resto vai em cartões de dica. */
export function CabecalhoEtapa({ n, children }: { n: number; children: ReactNode }) {
  const { titulo, Icone } = ETAPAS[n - 1]
  return (
    <header className="mb-6 flex items-start gap-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-acao text-acao-tinta shadow-[0_10px_24px_-10px_var(--acao)]" aria-hidden>
        <Icone className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-acao">
          Etapa {n} de {ETAPAS.length}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h1>
        <div className="mt-1 max-w-[70ch] text-tinta-2 [&_strong]:text-tinta">{children}</div>
      </div>
    </header>
  )
}

/**
 * Rodapé da etapa: volta para a anterior e avança para "para". Antes de liberado o link
 * continua clicável (a pessoa pode pular), só fica com cara de secundário e mostra o motivo.
 */
export function Avancar({ para, rotulo, liberado, motivo }: { para: number; rotulo: string; liberado: boolean; motivo?: string }) {
  const anterior = para - 2
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-caixa border bg-superficie p-3 shadow-caixa sm:p-4">
      {anterior >= 1 ? (
        <a href={href(`/oficina/${anterior}`)} className={botaoCls('discreto')}>
          <ArrowLeft className="size-4" aria-hidden /> Etapa {anterior}
        </a>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {!liberado && motivo && <p className="text-sm text-tinta-2">{motivo}</p>}
        <a
          href={href(`/oficina/${para}`)}
          aria-disabled={!liberado || undefined}
          className={cn(botaoCls(liberado ? 'primario' : 'secundario'), !liberado && 'opacity-70')}
        >
          {rotulo} <ArrowRight className="size-4" aria-hidden />
        </a>
      </div>
    </div>
  )
}
