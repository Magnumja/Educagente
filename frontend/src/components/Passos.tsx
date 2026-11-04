/**
 * Passos curtos dentro de uma etapa: mostra uma coisa por vez e deixa claro onde a pessoa está.
 * Usado nas etapas 2 (fontes), 4 (comparar) e 5 (NotebookLM).
 */
import { cn } from '@/lib/utils'

interface Props {
  titulos: readonly string[]
  atual: number
  aoEscolher: (i: number) => void
  rotulo: string
  /** Passo com o número em verde. Por padrão, os que vêm antes do atual. */
  feito?: (i: number) => boolean
  /** Passo que pode ser aberto. Por padrão, todos. */
  liberado?: (i: number) => boolean
}

export function Passos({ titulos, atual, aoEscolher, rotulo, feito = (i) => i < atual, liberado = () => true }: Props) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label={rotulo}>
      {titulos.map((titulo, i) => (
        <li key={titulo}>
          <button
            type="button"
            onClick={() => aoEscolher(i)}
            disabled={!liberado(i)}
            aria-current={atual === i ? 'step' : undefined}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-full border-[1.5px] py-1 pl-1 pr-4 text-sm font-semibold transition-[background-color,border-color] duration-200',
              'disabled:cursor-not-allowed disabled:opacity-50',
              atual === i ? 'border-acao bg-acao-suave' : 'border-linha bg-superficie hover:border-linha-forte',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'grid size-7 place-items-center rounded-full font-mono text-xs font-bold transition-colors duration-300',
                atual === i ? 'bg-acao text-acao-tinta' : feito(i) ? 'bg-ok text-superficie' : 'bg-superficie-2 text-tinta-2',
              )}
            >
              {i + 1}
            </span>
            {titulo}
          </button>
        </li>
      ))}
    </ol>
  )
}
