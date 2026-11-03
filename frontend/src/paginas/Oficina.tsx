import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BookMarked, Check, GraduationCap, Lightbulb, MessageSquareDashed, Scale, SearchCheck, type LucideIcon } from 'lucide-react'
import { Aviso, Carregando, botaoCls } from '@/components/ui'
import { api, ErroApi, sessao, type Estado } from '@/lib/api'
import { ETAPAS, progresso } from '@/lib/etapas'
import { href } from '@/lib/rota'
import { cn } from '@/lib/utils'
import { Comparar } from './oficina/Comparar'
import { Fontes } from './oficina/Fontes'
import { NotebookLM } from './oficina/NotebookLM'
import { Perguntas } from './oficina/Perguntas'

export interface PropsEtapa {
  estado: Estado
  recarregar: () => Promise<void>
}

const ICONES: Record<number, LucideIcon> = {
  1: MessageSquareDashed,
  2: BookMarked,
  3: SearchCheck,
  4: Scale,
  5: GraduationCap,
}

function etapaAtual(estado: Estado): number {
  const p = progresso(estado)
  return [1, 2, 3, 4].find((n) => !p[n]) ?? 5
}

export function Oficina({ etapa }: { etapa: number | null }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erro, setErro] = useState<ErroApi | null>(() => (sessao.participante() ? null : new ErroApi(401, '')))

  const recarregar = useCallback(async () => {
    try {
      setEstado(await api.estado())
      setErro(null)
    } catch (e) {
      const falha = e as ErroApi
      if (falha.status === 401) sessao.definirParticipante(null)
      setErro(falha)
    }
  }, [])

  useEffect(() => {
    if (sessao.participante()) recarregar()
  }, [recarregar])

  if (erro?.status === 401)
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Aviso tom="info" titulo="Você ainda não entrou numa oficina">
          Digite o código mostrado pelo facilitador para começar.
        </Aviso>
        <a href={href('/')} className={botaoCls('primario')}>
          Ir para o início
        </a>
      </div>
    )
  if (erro && !estado)
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Aviso tom="erro" titulo="Não deu para carregar a oficina">
          {erro.message}
        </Aviso>
        <button type="button" onClick={recarregar} className={botaoCls('secundario')}>
          Tentar de novo
        </button>
      </div>
    )
  if (!estado) return <Carregando />

  const n = etapa && etapa >= 1 && etapa <= 5 ? etapa : etapaAtual(estado)
  const props = { estado, recarregar }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
      <Trilha estado={estado} atual={n} />
      <div key={n} className="entrar-pagina min-w-0">
        {n === 1 && <Perguntas {...props} tentativa={1} />}
        {n === 2 && <Fontes {...props} />}
        {n === 3 && <Perguntas {...props} tentativa={2} />}
        {n === 4 && <Comparar {...props} />}
        {n === 5 && <NotebookLM {...props} />}
      </div>
    </div>
  )
}

/** Barra lateral fixa: progresso e etapas sempre à vista, sem precisar subir a página. */
function Trilha({ estado, atual }: { estado: Estado; atual: number }) {
  const feito = progresso(estado)
  const concluidas = [1, 2, 3, 4].filter((e) => feito[e]).length
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
            <span className="font-semibold tabular-nums">{concluidas} de 4</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-superficie-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={concluidas}
            aria-label="Etapas concluídas"
          >
            <div
              className="h-full rounded-full bg-acao transition-[width] duration-700 ease-[var(--ease-saida)]"
              style={{ width: `${(concluidas / 4) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="mt-4 flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
        {ETAPAS.map((e) => {
          const ativa = e.n === atual
          const Icone = ICONES[e.n]
          const estadoTexto = feito[e.n] ? 'Concluída' : ativa ? 'Você está aqui' : 'A fazer'
          return (
            <li key={e.n} className="relative shrink-0">
              {e.n < ETAPAS.length && (
                <span
                  className={cn(
                    'absolute left-[1.6rem] top-12 hidden h-[calc(100%-2.25rem)] w-0.5 rounded-full lg:block',
                    feito[e.n] ? 'bg-ok/50' : 'bg-linha',
                  )}
                  aria-hidden
                />
              )}
              <a
                href={href(`/oficina/${e.n}`)}
                aria-current={ativa ? 'step' : undefined}
                className={cn(
                  'relative flex min-h-14 items-center gap-3 rounded-p border-[1.5px] px-2.5 py-2 transition-[background-color,border-color] duration-200',
                  ativa ? 'border-acao bg-acao-suave' : 'border-transparent hover:bg-superficie-2',
                )}
              >
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-xl border-[1.5px] transition-colors',
                    feito[e.n]
                      ? 'border-ok bg-ok text-superficie'
                      : ativa
                        ? 'border-acao bg-acao text-acao-tinta shadow-[0_6px_16px_-6px_var(--acao)]'
                        : 'border-linha-forte bg-superficie text-tinta-2',
                  )}
                  aria-hidden
                >
                  {feito[e.n] ? <Check key="ok" className="estalo size-4" /> : <Icone className="size-4" />}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className={cn('block text-sm', ativa && 'font-semibold')}>
                    <span className="lg:hidden">{e.curto}</span>
                    <span className="hidden lg:inline">
                      {e.n}. {e.titulo}
                    </span>
                  </span>
                  <span className={cn('hidden text-xs lg:block', feito[e.n] ? 'text-ok' : ativa ? 'text-acao' : 'text-tinta-2')}>
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

/** Abertura da etapa, compacta: ícone, título e uma frase. O resto vai em cartões de dica. */
export function CabecalhoEtapa({ n, children }: { n: number; children: ReactNode }) {
  const info = ETAPAS[n - 1]
  const Icone = ICONES[n]
  return (
    <header className="mb-6 flex items-start gap-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-acao text-acao-tinta shadow-[0_10px_24px_-10px_var(--acao)]" aria-hidden>
        <Icone className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-acao">
          Etapa {n} de {ETAPAS.length}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{info.titulo}</h1>
        <div className="mt-1 max-w-[70ch] text-tinta-2 [&_strong]:text-tinta">{children}</div>
      </div>
    </header>
  )
}

export function Avancar({ para, rotulo, liberado, motivo }: { para: number; rotulo: string; liberado: boolean; motivo?: string }) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-caixa border bg-superficie p-3 shadow-caixa sm:p-4">
      {para > 2 ? (
        <a href={href(`/oficina/${para - 2}`)} className={botaoCls('discreto')}>
          <ArrowLeft className="size-4" aria-hidden /> Etapa {para - 2}
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
