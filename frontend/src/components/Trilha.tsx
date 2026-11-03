/**
 * Barra lateral da oficina: título, apelido, barra de progresso e a lista das cinco etapas.
 * Fica fixa (sticky) no desktop para o progresso estar sempre à vista; no celular vira uma
 * faixa horizontal. Tudo é calculado a partir do estado (progresso() em lib/etapas).
 */
import { Check, Lightbulb } from 'lucide-react'
import type { Estado } from '@/lib/api'
import { ETAPAS, ETAPAS_COM_PROGRESSO, progresso } from '@/lib/etapas'
import { href } from '@/lib/rota'
import { cn } from '@/lib/utils'

export function Trilha({ estado, atual }: { estado: Estado; atual: number }) {
  const feito = progresso(estado)
  const total = ETAPAS_COM_PROGRESSO.length
  const concluidas = ETAPAS_COM_PROGRESSO.filter((e) => feito[e]).length
  return (
    <nav
      aria-label="Etapas da oficina"
      className="flex flex-col rounded-caixa border bg-superficie p-4 shadow-caixa lg:sticky lg:top-4 lg:min-h-[calc(100dvh-7rem)] lg:self-start lg:p-5"
    >
      <div className="border-b pb-4">
        <p className="text-xs font-semibold text-acao">Oficina</p>
        <p className="mt-0.5 font-semibold leading-snug">{estado.oficina.titulo}</p>
        <p className="mt-1 text-sm text-tinta-2">Você entrou como {estado.apelido}</p>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-tinta-2">Seu progresso</span>
            <span className="font-semibold tabular-nums">
              {concluidas} de {total}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-superficie-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={concluidas}
            aria-label="Etapas concluídas"
          >
            <div
              className="h-full rounded-full bg-acao transition-[width] duration-700 ease-[var(--ease-saida)]"
              style={{ width: `${(concluidas / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="mt-4 flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
        {ETAPAS.map(({ n, curto, titulo, Icone }) => {
          const ativa = n === atual
          const concluida = feito[n]
          const estadoTexto = concluida ? 'Concluída' : ativa ? 'Você está aqui' : 'A fazer'
          return (
            <li key={n} className="relative shrink-0">
              {/* Linha vertical que liga uma etapa à próxima (só no desktop). */}
              {n < ETAPAS.length && (
                <span
                  className={cn(
                    'absolute left-[1.6rem] top-12 hidden h-[calc(100%-2.25rem)] w-0.5 rounded-full lg:block',
                    concluida ? 'bg-ok/50' : 'bg-linha',
                  )}
                  aria-hidden
                />
              )}
              <a
                href={href(`/oficina/${n}`)}
                aria-current={ativa ? 'step' : undefined}
                className={cn(
                  'relative flex min-h-14 items-center gap-3 rounded-p border-[1.5px] px-2.5 py-2 transition-[background-color,border-color] duration-200',
                  ativa ? 'border-acao bg-acao-suave' : 'border-transparent hover:bg-superficie-2',
                )}
              >
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-xl border-[1.5px] transition-colors',
                    concluida
                      ? 'border-ok bg-ok text-superficie'
                      : ativa
                        ? 'border-acao bg-acao text-acao-tinta shadow-[0_6px_16px_-6px_var(--acao)]'
                        : 'border-linha-forte bg-superficie text-tinta-2',
                  )}
                  aria-hidden
                >
                  {/* O Check só monta ao concluir, e a animação .estalo roda nessa hora. */}
                  {concluida ? <Check key="ok" className="estalo size-4" /> : <Icone className="size-4" />}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className={cn('block text-sm', ativa && 'font-semibold')}>
                    <span className="lg:hidden">{curto}</span>
                    <span className="hidden lg:inline">
                      {n}. {titulo}
                    </span>
                  </span>
                  <span className={cn('hidden text-xs lg:block', concluida ? 'text-ok' : ativa ? 'text-acao' : 'text-tinta-2')}>
                    {estadoTexto}
                  </span>
                  <span className="sr-only lg:hidden"> ({estadoTexto})</span>
                </span>
              </a>
            </li>
          )
        })}
      </ol>

      <a
        href={href('/como-funciona')}
        className="mt-auto hidden items-center gap-2 rounded-p border-t px-1 pt-4 text-sm font-semibold text-acao hover:underline lg:flex"
      >
        <Lightbulb className="size-4" aria-hidden /> Como a IA usa fontes?
      </a>
    </nav>
  )
}
