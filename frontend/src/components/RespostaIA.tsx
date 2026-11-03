import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { BookMarked, Bot, ChevronDown, Clock, FileText, MessageSquareDashed, SearchX } from 'lucide-react'
import type { Resposta, Trecho } from '@/lib/api'
import { usePreferencias } from '@/lib/preferencias'
import { cn, plural, porcentagem } from '@/lib/utils'

/** Selo de procedência: diz, com texto e ícone (nunca só com cor), de onde veio a resposta. */
export function Procedencia({ resposta }: { resposta: Resposta }) {
  if (resposta.tentativa === 1)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-linha-forte bg-superficie px-2.5 py-0.5 text-sm font-medium text-tinta-2">
        <MessageSquareDashed className="size-4" aria-hidden /> Sem fonte: veio só do treino do modelo
      </span>
    )
  if (resposta.nada_relevante)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-alerta/50 bg-alerta-fundo px-2.5 py-0.5 text-sm font-medium">
        <SearchX className="size-4 text-alerta" aria-hidden /> Nada encontrado nas fontes
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-evidencia-tinta/40 bg-evidencia px-2.5 py-0.5 text-sm font-medium text-tinta">
      <BookMarked className="size-4" aria-hidden /> Com fontes: {plural(resposta.trechos.length, 'trecho')}
    </span>
  )
}

function irParaTrecho(prefixo: string, n: number | string) {
  // Espera o painel abrir antes de rolar até o trecho.
  requestAnimationFrame(() => {
    const alvo = document.getElementById(`${prefixo}-${n}`)
    alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    alvo?.focus({ preventScroll: true })
  })
}

/** Troca "[2]" no texto por um botão que abre o trecho citado. */
function TextoComCitacoes({ texto, trechos, aoCitar }: { texto: string; trechos: Trecho[]; aoCitar: (n: string) => void }) {
  const partes = texto.split(/(\[\d+\])/g)
  return (
    <p className="whitespace-pre-line text-[1.02rem] leading-relaxed">
      {partes.map((parte, i) => {
        const n = /^\[(\d+)\]$/.exec(parte)?.[1]
        const trecho = n ? trechos[Number(n) - 1] : undefined
        if (!n || !trecho) return <Fragment key={i}>{parte}</Fragment>
        return (
          <button
            key={i}
            type="button"
            onClick={() => aoCitar(n)}
            className="mx-0.5 rounded-md border border-evidencia-tinta/50 bg-evidencia px-1.5 align-baseline font-mono text-[0.8em] font-semibold text-tinta transition-transform hover:-translate-y-px hover:border-tinta"
            aria-label={`Ver trecho ${n}: ${trecho.documento}, página ${trecho.pagina}`}
          >
            {n}
          </button>
        )
      })}
    </p>
  )
}

function ListaDeTrechos({ trechos, prefixo }: { trechos: Trecho[]; prefixo: string }) {
  const { prefs } = usePreferencias()
  return (
    <ol className="space-y-2.5">
      {trechos.map((t, i) => (
        <li
          key={i}
          id={`${prefixo}-${i + 1}`}
          tabIndex={-1}
          style={{ '--i': i } as CSSProperties}
          className="surgir rounded-p border bg-superficie p-3.5 focus:outline-3 focus:outline-foco"
        >
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
            <span className="rounded-md bg-evidencia px-1.5 font-mono">{i + 1}</span>
            <FileText className="size-4 text-tinta-2" aria-hidden />
            {t.documento}, página {t.pagina}
            {prefs.detalhe === 'tecnico' && (
              <span className="font-normal text-tinta-2">· similaridade {porcentagem(t.similaridade)}</span>
            )}
          </p>
          <blockquote className="mt-2 text-[0.95rem] leading-relaxed">
            <span className="marca-texto" style={{ '--i': i } as CSSProperties}>
              {t.texto}
            </span>
          </blockquote>
        </li>
      ))}
    </ol>
  )
}

export function RespostaIA({ resposta, compacta, trechosAbertos }: { resposta: Resposta; compacta?: boolean; trechosAbertos?: boolean }) {
  const { prefs } = usePreferencias()
  const prefixo = useId().replace(/:/g, '')
  const [aberto, setAberto] = useState(!!trechosAbertos)
  const temTrechos = resposta.trechos.length > 0
  // Resposta longa fica num bloco baixo (formato paisagem), com "ler inteira" para abrir.
  const caixaTexto = useRef<HTMLDivElement>(null)
  const [cortada, setCortada] = useState(false)
  const [inteira, setInteira] = useState(false)
  useLayoutEffect(() => {
    const el = caixaTexto.current
    if (el) setCortada(el.scrollHeight > 11 * parseFloat(getComputedStyle(document.documentElement).fontSize) + 8)
  }, [resposta.texto])

  function citar(n: number | string) {
    setAberto(true)
    irParaTrecho(prefixo, n)
  }

  return (
    <div className="surgir flex gap-3">
      <span
        className={cn(
          'mt-1 hidden size-9 shrink-0 place-items-center rounded-full border sm:grid',
          resposta.tentativa === 1 ? 'border-dashed border-linha-forte bg-superficie text-tinta-2' : 'border-transparent bg-acao text-acao-tinta',
        )}
        aria-hidden
      >
        <Bot className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Procedencia resposta={resposta} />
          <span className="inline-flex items-center gap-1 text-sm text-tinta-2">
            <Clock className="size-3.5" aria-hidden /> {tempo(resposta.tempo_segundos)}
          </span>
        </div>

        <div
          className={cn(
            'relative rounded-caixa rounded-tl-md border px-4 py-3.5',
            resposta.tentativa === 1 ? 'border-dashed border-linha-forte bg-superficie-2/60' : 'bg-superficie-2',
          )}
        >
          <div
            ref={caixaTexto}
            className={cn('overflow-hidden transition-[max-height] duration-300', cortada && !inteira && 'max-h-44')}
          >
            <TextoComCitacoes texto={resposta.texto} trechos={resposta.trechos} aoCitar={citar} />
          </div>
          {cortada && !inteira && (
            <div
              className="pointer-events-none absolute inset-x-px bottom-12 h-14 bg-gradient-to-t from-[var(--superficie-2)] to-transparent"
              aria-hidden
            />
          )}
          {cortada && (
            <button
              type="button"
              aria-expanded={inteira}
              onClick={() => setInteira((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-acao hover:bg-acao-suave"
            >
              {inteira ? 'Mostrar menos' : 'Ler a resposta inteira'}
              <ChevronDown className={cn('size-4 transition-transform duration-200', inteira && 'rotate-180')} aria-hidden />
            </button>
          )}
        </div>

        {temTrechos && !compacta && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-tinta-2">De onde veio:</span>
              {resposta.trechos.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => citar(i + 1)}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-superficie px-2.5 py-1 text-sm transition-colors hover:border-evidencia-tinta hover:bg-evidencia/50"
                >
                  <span className="rounded bg-evidencia px-1 font-mono text-xs font-bold">{i + 1}</span>
                  {t.documento} · p. {t.pagina}
                </button>
              ))}
              <button
                type="button"
                aria-expanded={aberto}
                onClick={() => setAberto((a) => !a)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-acao hover:bg-acao-suave"
              >
                {aberto ? 'Esconder os trechos' : 'Ler os trechos'}
                <ChevronDown className={cn('size-4 transition-transform duration-200', aberto && 'rotate-180')} aria-hidden />
              </button>
            </div>
            {aberto && <ListaDeTrechos trechos={resposta.trechos} prefixo={prefixo} />}
          </div>
        )}

        {prefs.detalhe === 'tecnico' && resposta.instrucoes_enviadas && !compacta && (
          <details className="rounded-p border bg-superficie p-3 text-sm">
            <summary className="flex items-center gap-1.5 font-semibold">
              <ChevronDown className="seta size-4 -rotate-90" aria-hidden /> Ver as instruções exatas enviadas à IA
            </summary>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[0.8rem] leading-relaxed text-tinta-2">
              {resposta.instrucoes_enviadas}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

function tempo(segundos: number) {
  if (segundos < 1) return 'menos de 1 s'
  return `${Math.round(segundos)} s para responder`
}

/** Espera com relógio: no laboratório a IA pode demorar, e isso é informação, não falha. */
export function Escrevendo({ comFontes }: { comFontes?: boolean }) {
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [])
  return (
    <div role="status" aria-live="polite" className="surgir flex gap-3">
      <span className="mt-1 hidden size-9 shrink-0 place-items-center rounded-full bg-acao-suave text-acao sm:grid" aria-hidden>
        <Bot className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <span className="inline-flex gap-1" aria-hidden>
            <span className="ponto-digitando size-1.5 rounded-full bg-acao" />
            <span className="ponto-digitando size-1.5 rounded-full bg-acao" />
            <span className="ponto-digitando size-1.5 rounded-full bg-acao" />
          </span>
          {comFontes ? 'Buscando nas suas fontes e escrevendo…' : 'A IA está escrevendo…'}
          <span className="font-mono text-sm text-tinta-2" aria-hidden>
            {segundos} s
          </span>
        </p>
        <div className="space-y-2 rounded-caixa rounded-tl-md border p-4" aria-hidden>
          <div className="brilho-carregando h-3.5 w-11/12 rounded" />
          <div className="brilho-carregando h-3.5 w-4/5 rounded" />
          <div className="brilho-carregando h-3.5 w-2/3 rounded" />
        </div>
        {segundos >= 10 && <p className="text-sm text-tinta-2">No computador da turma isso pode levar até um minuto.</p>}
      </div>
    </div>
  )
}
