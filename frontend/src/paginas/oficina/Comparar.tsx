import { useRef, useState, type CSSProperties } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookMarked,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareDashed,
  MessagesSquare,
  Scale,
} from 'lucide-react'
import { RespostaIA } from '@/components/RespostaIA'
import { Aviso, Botao, Caixa, Campo, Dica, NumeroDoPasso, Segmentado, entradaCls } from '@/components/ui'
import { api, type Avaliacao, type Pergunta, type Preferencia, type Veredito } from '@/lib/api'
import { href } from '@/lib/rota'
import { cn } from '@/lib/utils'
import { Avancar, CabecalhoEtapa, type PropsEtapa } from '../Oficina'

const VEREDITOS: { valor: Veredito; rotulo: string }[] = [
  { valor: 'correta', rotulo: 'Correta' },
  { valor: 'parcial', rotulo: 'Em parte' },
  { valor: 'errada', rotulo: 'Errada' },
  { valor: 'nao_sei', rotulo: 'Não sei dizer' },
]

const PREFERENCIAS: { valor: Preferencia; rotulo: string }[] = [
  { valor: 'primeira', rotulo: 'A sem contexto' },
  { valor: 'segunda', rotulo: 'A com fontes' },
  { valor: 'nenhuma', rotulo: 'Nenhuma das duas' },
]

/** Cada pergunta é comparada em três páginas curtas, para não precisar rolar muito. */
const PAGINAS = ['Leia as respostas', 'Diga o que concluiu', 'Confira a referência'] as const

export function Comparar({ estado, recarregar }: PropsEtapa) {
  const prontas = estado.perguntas.filter((p) => estado.respostas.filter((r) => r.pergunta_id === p.id).length === 2)
  const avaliadas = new Set(estado.avaliacoes.map((a) => a.pergunta_id))
  const primeiraPendente = Math.max(
    0,
    estado.perguntas.findIndex((p) => !avaliadas.has(p.id)),
  )
  const [selecionada, setSelecionada] = useState(primeiraPendente)
  const topo = useRef<HTMLDivElement>(null)

  if (prontas.length === 0)
    return (
      <div>
        <CabecalhoEtapa n={4}>
          <p>Aqui você coloca lado a lado as duas respostas de cada pergunta e decide em qual dá para confiar.</p>
        </CabecalhoEtapa>
        <Aviso tom="alerta" titulo="Ainda não há o que comparar">
          Faça as perguntas na{' '}
          <a href={href('/oficina/1')} className="font-semibold text-acao underline underline-offset-4">
            etapa 1
          </a>{' '}
          e na{' '}
          <a href={href('/oficina/3')} className="font-semibold text-acao underline underline-offset-4">
            etapa 3
          </a>{' '}
          primeiro.
        </Aviso>
      </div>
    )

  const pergunta = estado.perguntas[selecionada]
  const irParaPergunta = (i: number) => {
    setSelecionada(i)
    topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const todasAvaliadas = estado.avaliacoes.length >= estado.perguntas.length

  return (
    <div>
      <CabecalhoEtapa n={4}>
        <p>
          Mesma pergunta, duas respostas. Uma pergunta por vez, em <strong>três passos curtos</strong>.
        </p>
      </CabecalhoEtapa>

      <div ref={topo} className="mb-5 flex scroll-mt-4 flex-wrap gap-2" role="group" aria-label="Escolher pergunta">
        {estado.perguntas.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={i === selecionada}
            title={p.texto}
            onClick={() => irParaPergunta(i)}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-semibold transition-[background-color,border-color] duration-200',
              i === selecionada ? 'border-acao bg-acao-suave' : 'border-linha bg-superficie hover:border-linha-forte',
            )}
          >
            Pergunta {p.ordem}
            {avaliadas.has(p.id) ? (
              <span className="inline-flex items-center gap-1 font-medium text-ok">
                <CheckCircle2 className="estalo size-4" aria-hidden /> avaliada
              </span>
            ) : (
              <span className="font-normal text-tinta-2">a avaliar</span>
            )}
          </button>
        ))}
      </div>

      <PaginasDaPergunta
        key={pergunta.id}
        pergunta={pergunta}
        estado={estado}
        recarregar={recarregar}
        avaliada={avaliadas.has(pergunta.id)}
        proxima={selecionada < estado.perguntas.length - 1 ? () => irParaPergunta(selecionada + 1) : undefined}
        aoMudarPagina={() => topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />

      {todasAvaliadas && (
        <Caixa className="surgir mt-8 space-y-3 bg-superficie-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessagesSquare className="size-5 text-acao" aria-hidden /> Para conversar com a turma
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-tinta-2">
            <li>Alguma resposta sem contexto pareceu certa, mas você não tinha como conferir?</li>
            <li>Com fontes, a IA disse quando não sabia? Ou completou com coisas que não estavam nos trechos?</li>
            <li>Quem controla a qualidade da resposta: o modelo, as fontes ou quem escolhe as fontes?</li>
          </ul>
        </Caixa>
      )}

      <Avancar
        para={5}
        rotulo="Estudar com o NotebookLM"
        liberado={todasAvaliadas}
        motivo={`Faltam ${estado.perguntas.length - estado.avaliacoes.length} avaliações.`}
      />
    </div>
  )
}

function PaginasDaPergunta({
  pergunta,
  estado,
  recarregar,
  avaliada,
  proxima,
  aoMudarPagina,
}: PropsEtapa & { pergunta: Pergunta; avaliada: boolean; proxima?: () => void; aoMudarPagina: () => void }) {
  const [pagina, setPagina] = useState(avaliada ? 2 : 0)
  const primeira = estado.respostas.find((r) => r.pergunta_id === pergunta.id && r.tentativa === 1)
  const segunda = estado.respostas.find((r) => r.pergunta_id === pergunta.id && r.tentativa === 2)
  const salva = estado.avaliacoes.find((a) => a.pergunta_id === pergunta.id)
  const referencia = estado.referencias[String(pergunta.id)]

  // A referência só abre depois da avaliação: primeiro a pessoa pensa sozinha.
  const liberadas = [true, true, avaliada]
  const ir = (n: number) => {
    setPagina(n)
    aoMudarPagina()
  }

  if (!primeira || !segunda)
    return (
      <Aviso tom="alerta" titulo="Falta uma das respostas">
        Esta pergunta precisa ser feita sem contexto (etapa 1) e com fontes (etapa 3).
      </Aviso>
    )

  return (
    <article aria-labelledby={`p-${pergunta.id}`} className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id={`p-${pergunta.id}`} className="text-2xl font-semibold">
          <span className="font-mono text-tinta-2">{pergunta.ordem}.</span> {pergunta.texto}
        </h2>
      </div>

      <ol className="flex flex-wrap gap-2" aria-label="Passos desta pergunta">
        {PAGINAS.map((titulo, i) => (
          <li key={titulo}>
            <button
              type="button"
              onClick={() => ir(i)}
              disabled={!liberadas[i]}
              aria-current={pagina === i ? 'step' : undefined}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-full border-[1.5px] py-1 pl-1 pr-4 text-sm font-semibold transition-[background-color,border-color] duration-200',
                'disabled:cursor-not-allowed disabled:opacity-50',
                pagina === i ? 'border-acao bg-acao-suave' : 'border-linha bg-superficie hover:border-linha-forte',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-7 place-items-center rounded-full font-mono text-xs font-bold transition-colors duration-300',
                  pagina === i ? 'bg-acao text-acao-tinta' : i < pagina || (i === 1 && avaliada) ? 'bg-ok text-superficie' : 'bg-superficie-2 text-tinta-2',
                )}
              >
                {i + 1}
              </span>
              {titulo}
            </button>
          </li>
        ))}
      </ol>

      <div key={pagina} className="entrar-pagina">
        {pagina === 0 && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section aria-label="Resposta sem contexto" className="rounded-caixa border-[1.5px] border-dashed border-linha-forte bg-superficie/80 p-5">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <MessageSquareDashed className="size-5 text-tinta-2" aria-hidden /> 1ª tentativa: sem contexto
              </h3>
              <RespostaIA resposta={primeira} />
            </section>
            <section
              aria-label="Resposta com fontes"
              style={{ '--i': 1 } as CSSProperties}
              className="surgir rounded-caixa border-[1.5px] border-acao/40 bg-superficie p-5 shadow-caixa"
            >
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <BookMarked className="size-5 text-acao" aria-hidden /> 2ª tentativa: com fontes
              </h3>
              <RespostaIA resposta={segunda} />
            </section>
          </div>
        )}

        {pagina === 1 && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Dica Icone={Scale} titulo="Não existe avaliação errada">
                O importante é ter um motivo. “Não sei dizer” também é uma resposta honesta.
              </Dica>
              <Dica Icone={AlertTriangle} titulo="Fonte não é garantia" style={{ '--i': 1 } as CSSProperties}>
                Se a fonte estiver errada ou incompleta, a resposta com fontes também fica.
              </Dica>
            </div>
            <FormularioDeAvaliacao perguntaId={pergunta.id} salva={salva} recarregar={recarregar} aoSalvar={() => ir(2)} />
          </div>
        )}

        {pagina === 2 && (
          <div className="space-y-5">
            {referencia ? (
              <Caixa className="space-y-3 border-ok/40">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <ClipboardCheck className="size-5 text-ok" aria-hidden /> Resposta conferida pelo facilitador
                </h3>
                <p className="whitespace-pre-line text-[1.02rem] leading-relaxed">{referencia}</p>
              </Caixa>
            ) : (
              <Aviso tom="info" titulo="Sem resposta de referência">
                O facilitador não cadastrou uma referência para esta pergunta. Confira pela fonte ou converse com a turma.
              </Aviso>
            )}
            {salva && <ResumoDaAvaliacao avaliacao={salva} />}
            <p className="text-tinta-2">Bate com o que você concluiu? Se não, o que te levou a pensar diferente?</p>
          </div>
        )}
      </div>

      <nav aria-label="Navegar nos passos" className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        {pagina > 0 ? (
          <Botao variante="discreto" onClick={() => ir(pagina - 1)}>
            <ArrowLeft className="size-4" aria-hidden /> {PAGINAS[pagina - 1]}
          </Botao>
        ) : (
          <span />
        )}
        {pagina === 0 && (
          <Botao variante="primario" onClick={() => ir(1)}>
            Avaliar as respostas <ArrowRight className="size-4" aria-hidden />
          </Botao>
        )}
        {pagina === 2 && proxima && (
          <Botao variante="primario" onClick={proxima}>
            Próxima pergunta <ArrowRight className="size-4" aria-hidden />
          </Botao>
        )}
      </nav>
    </article>
  )
}

const ROTULO_VEREDITO = Object.fromEntries(VEREDITOS.map((v) => [v.valor, v.rotulo.toLowerCase()]))
const ROTULO_PREFERENCIA = Object.fromEntries(PREFERENCIAS.map((p) => [p.valor, p.rotulo.toLowerCase()]))

function ResumoDaAvaliacao({ avaliacao }: { avaliacao: Avaliacao }) {
  return (
    <div className="rounded-caixa border bg-superficie-2/60 p-4">
      <p className="mb-2 text-sm font-semibold text-tinta-2">Você disse que:</p>
      <ul className="space-y-1">
        <li>
          a sem contexto estava <strong>{ROTULO_VEREDITO[avaliacao.primeira]}</strong>;
        </li>
        <li>
          a com fontes estava <strong>{ROTULO_VEREDITO[avaliacao.segunda]}</strong>;
        </li>
        <li>
          confiaria mais em <strong>{ROTULO_PREFERENCIA[avaliacao.mais_confiavel]}</strong>.
        </li>
      </ul>
    </div>
  )
}

function FormularioDeAvaliacao({
  perguntaId,
  salva,
  recarregar,
  aoSalvar,
}: {
  perguntaId: number
  salva?: Avaliacao
  recarregar: () => Promise<void>
  aoSalvar: () => void
}) {
  const [primeira, setPrimeira] = useState<Veredito | null>(salva?.primeira ?? null)
  const [segunda, setSegunda] = useState<Veredito | null>(salva?.segunda ?? null)
  const [maisConfiavel, setMaisConfiavel] = useState<Preferencia | null>(salva?.mais_confiavel ?? null)
  const [conferiu, setConferiu] = useState(salva?.conferiu_fonte ?? false)
  const [observacao, setObservacao] = useState(salva?.observacao ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const completo = primeira && segunda && maisConfiavel

  async function salvar() {
    if (!primeira || !segunda || !maisConfiavel) return
    setSalvando(true)
    setErro('')
    try {
      await api.avaliar(perguntaId, { primeira, segunda, mais_confiavel: maisConfiavel, conferiu_fonte: conferiu, observacao })
      await recarregar()
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <Caixa className="space-y-6">
      <ol className="space-y-5">
        {(
          [
            [primeira, <Segmentado key="a" legenda="A resposta sem contexto estava…" valor={primeira} opcoes={VEREDITOS} aoMudar={setPrimeira} />],
            [segunda, <Segmentado key="b" legenda="A resposta com fontes estava…" valor={segunda} opcoes={VEREDITOS} aoMudar={setSegunda} />],
            [
              maisConfiavel,
              <Segmentado key="c" legenda="Em qual você confiaria para estudar?" valor={maisConfiavel} opcoes={PREFERENCIAS} aoMudar={setMaisConfiavel} />,
            ],
          ] as const
        ).map(([valor, campo], i) => (
          <li key={i} className="flex gap-4">
            <NumeroDoPasso n={valor ? '✓' : i + 1} tom={valor ? 'ok' : 'neutro'} />
            <div className="min-w-0 flex-1 pt-1">{campo}</div>
          </li>
        ))}
      </ol>
      <label className="flex items-start gap-3 font-medium">
        <input
          type="checkbox"
          checked={conferiu}
          onChange={(e) => setConferiu(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-[var(--acao)]"
        />
        Abri os trechos citados e conferi se a resposta diz o mesmo que a fonte.
      </label>
      <Campo rotulo="Por quê? (opcional)" dica="Uma frase já ajuda: o que você notou de diferente?">
        {(p) => (
          <textarea
            {...p}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            maxLength={600}
            className={cn(entradaCls, 'resize-y')}
          />
        )}
      </Campo>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div className="flex flex-wrap items-center gap-3">
        <Botao variante="primario" onClick={salvar} disabled={!completo} carregando={salvando}>
          {salva ? 'Atualizar e ver a referência' : 'Salvar e ver a referência'} <ArrowRight className="size-4" aria-hidden />
        </Botao>
        {!completo && <span className="text-sm text-tinta-2">Responda os três itens acima para salvar.</span>}
      </div>
    </Caixa>
  )
}
