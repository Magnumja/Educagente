/**
 * Etapa 3: esquema animado do RAG, na mesma ordem do backend: cortar, virar números, buscar,
 * montar o pedido e responder. Abre abaixo de uma resposta e usa os dados verdadeiros dela: a
 * busca com todos os trechos (GET /eu/perguntas/{id}/busca), a regra enviada e o texto. Só o desenho das barras é ilustração: os vetores de verdade não saem do servidor.
 * Se a busca não vier (servidor fora, base mudou), mostra o que a resposta salva já traz.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Bot, FileText, Mail, Pause, Play, RotateCcw, SearchX } from 'lucide-react'
import { Passos } from '@/components/Passos'
import { Botao } from '@/components/ui'
import { api, type Busca, type Estado, type Pergunta, type Resposta, type Trecho, type TrechoNaBusca } from '@/lib/api'
import { atraso, cn, plural } from '@/lib/utils'

const CENAS = [
  { titulo: 'Cortar', ms: 4500 },
  { titulo: 'Virar números', ms: 5000 },
  { titulo: 'Buscar', ms: 12000 },
  { titulo: 'Montar o pedido', ms: 10000 },
  { titulo: 'Responder', ms: 0 },
] as const
const TITULOS = CENAS.map((c) => c.titulo)
const MAX_CARTOES = 12
const MAX_DE_FORA = 4
const MAX_QUADRADOS = 40
const BARRAS = 18

const semMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface Props {
  estado: Estado
  pergunta: Pergunta
  /** A resposta com fontes desta pergunta. */
  resposta: Resposta
}

export function CaminhoRag({ estado, pergunta, resposta }: Props) {
  const [cena, setCena] = useState(0)
  const [tocando, setTocando] = useState(() => !semMovimento())
  const ultima = CENAS.length - 1

  useEffect(() => {
    if (!tocando) return
    const t = setTimeout(() => (cena === ultima ? setTocando(false) : setCena(cena + 1)), CENAS[cena].ms)
    return () => clearTimeout(t)
  }, [tocando, cena, ultima])

  const totalNaBase = estado.documentos.reduce((soma, d) => soma + d.trechos, 0)
  const [busca, setBusca] = useState<Busca | null>(null)
  const quando = resposta.criado_em

  // Busca de novo se a resposta ou a base mudarem. Sem resposta do servidor, o esquema segue sem ela.
  useEffect(() => {
    let valendo = true
    api
      .busca(pergunta.id)
      .then((b) => valendo && setBusca(b))
      .catch(() => valendo && setBusca(null))
    return () => {
      valendo = false
    }
  }, [pergunta.id, quando, totalNaBase])

  const real = busca && !busca.mudou_desde_a_resposta ? busca : null
  const total = real?.total ?? totalNaBase
  const nomes = estado.documentos.map((d) => d.nome).join(', ')
  const trechos = resposta.trechos
  const nada = resposta.nada_relevante
  const temCitacao = /\[\d+\]/.test(resposta.texto)

  const legendas = [
    <>
      Quando você adicionou <Forte>{nomes}</Forte>, a plataforma cortou o texto em <Forte>{plural(total, 'trecho')}</Forte>, em geral
      um por parágrafo, para cada citação apontar uma ideia só.
    </>,
    <>Cada trecho vira uma lista longa de números que representa o assunto dele. Assim o computador compara significados, não só palavras iguais.</>,
    nada ? (
      <>A pergunta também virou números, mas <Forte>nenhum dos {total} trechos</Forte> ficou parecido o bastante: todos ficaram antes do traço do mínimo.</>
    ) : (
      <>
        A pergunta também virou números. Comparada com {plural(total, 'trecho')},{' '}
        {trechos.length === 1 ? (
          <>
            só <Forte>1 trecho</Forte> entrou.
          </>
        ) : (
          <>
            <Forte>{trechos.length} trechos</Forte> entraram, do mais parecido para o menos.
          </>
        )}
        {real && ` Entram no máximo ${real.top_k}, e só se passarem do traço do mínimo.`}
      </>
    ),
    nada ? (
      <>Sem trecho relevante, o pedido nem é enviado. Assim a IA não tem como inventar uma resposta.</>
    ) : (
      <>A IA não lê a sua fonte inteira. Ela recebe só este pedido: uma regra, os trechos numerados e a pergunta.</>
    ),
    nada ? (
      <>Quem respondeu foi a própria plataforma, dizendo que não encontrou nada. Isso também é uma boa resposta.</>
    ) : !temCitacao ? (
      <>
        A IA escreveu a partir do pedido, mas <Forte>não marcou de qual trecho veio cada parte</Forte>, mesmo a regra pedindo. Isso
        acontece: confira você mesmo nos trechos que ela recebeu.
      </>
    ) : (
      <>
        A IA escreve a partir do pedido e marca em amarelo o trecho de onde veio cada parte. <Forte>Mesmo assim ela pode errar:</Forte>{' '}
        abra os trechos e confira.
      </>
    ),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Passos
          titulos={TITULOS}
          atual={cena}
          rotulo="Cenas do esquema"
          aoEscolher={(i) => {
            setCena(i)
            setTocando(false)
          }}
        />
        {tocando ? (
          <Botao tamanho="p" variante="discreto" onClick={() => setTocando(false)}>
            <Pause className="size-4" aria-hidden /> Pausar
          </Botao>
        ) : cena < ultima ? (
          <Botao tamanho="p" variante="discreto" onClick={() => setTocando(true)}>
            <Play className="size-4" aria-hidden /> Continuar
          </Botao>
        ) : (
          <Botao
            tamanho="p"
            variante="discreto"
            onClick={() => {
              setCena(0)
              setTocando(true)
            }}
          >
            <RotateCcw className="size-4" aria-hidden /> Ver de novo
          </Botao>
        )}
      </div>

      <p key={`legenda-${cena}`} className="surgir min-h-14 text-tinta-2" aria-live={tocando ? 'off' : 'polite'}>
        {legendas[cena]}
      </p>
      {/* key={cena}: cada cena entra do zero, com as suas animações. */}
      <div key={cena} className="flex min-h-[22rem] flex-col justify-center overflow-hidden rounded-p bg-superficie-2 p-4 sm:p-6">
        {cena === 0 && <CenaCortar nomes={nomes} total={total} busca={real} />}
        {cena === 1 && <CenaNumeros total={total} busca={real} />}
        {cena === 2 && <CenaBuscar pergunta={pergunta} total={total} resposta={resposta} busca={real} />}
        {cena === 3 && <CenaPedido pergunta={pergunta} resposta={resposta} />}
        {cena === 4 && <CenaResponder resposta={resposta} />}
      </div>

      <p className="text-xs text-tinta-2">
        {busca?.mudou_desde_a_resposta
          ? 'Sua base de fontes mudou depois desta resposta: aqui aparece só o que foi usado nela. Pergunte de novo para ver o caminho completo.'
          : 'Os trechos, a parecença, o pedido e a resposta são os verdadeiros desta pergunta. Só o desenho das barras é ilustrativo.'}
        {total > MAX_CARTOES ? ` Aparecem ${MAX_CARTOES} dos ${total} cartões.` : ''}
      </p>
    </div>
  )
}

function Forte({ children }: { children: ReactNode }) {
  return <strong className="text-tinta">{children}</strong>
}

/** Altura (0 a 1) de uma barra do desenho; sempre a mesma para a mesma semente. */
const alturaDaBarra = (semente: number, j: number) => (((semente * 31 + j * 47 + j * j * 13) % 80) + 20) / 100

/**
 * Desenho de uma lista de números: barrinhas. Quanto maior `parecido` (0 a 1), mais o desenho se
 * aproxima do da pergunta: é a parecença real virando imagem, sem número para confundir.
 */
function Vetor({ semente, parecido = 0, className }: { semente: number; parecido?: number; className?: string }) {
  return (
    <span className={cn('flex h-7 w-full items-end gap-[2px] text-acao', className)} aria-hidden>
      {Array.from({ length: BARRAS }, (_, j) => {
        const propria = alturaDaBarra(semente + 7, j)
        const daPergunta = alturaDaBarra(0, j)
        const altura = propria + (daPergunta - propria) * parecido
        return (
          <span
            key={j}
            className="rag-crescer flex-1 rounded-[1px] bg-current"
            style={{ height: `${altura * 100}%`, animationDelay: `${(semente % MAX_CARTOES) * 60 + j * 20}ms` }}
          />
        )
      })}
    </span>
  )
}

/** Os trechos na ordem da fonte, para as duas primeiras cenas. Sem a busca, cartões sem texto. */
function cartoesDe(total: number, busca: Busca | null) {
  if (busca) return [...busca.trechos].sort((a, b) => a.ordem - b.ordem).slice(0, MAX_CARTOES)
  return Array.from({ length: Math.min(total, MAX_CARTOES) }, (_, ordem) => ({ ordem, texto: '' }))
}

function CenaCortar({ nomes, total, busca }: { nomes: string; total: number; busca: Busca | null }) {
  return (
    <div className="grid items-center gap-5 md:grid-cols-[minmax(0,13rem)_auto_minmax(0,1fr)]">
      <div className="surgir rounded-p border-[1.5px] border-acao bg-superficie p-4 shadow-caixa">
        <FileText className="size-7 text-acao" aria-hidden />
        <p className="mt-2 break-words font-semibold">{nomes}</p>
        <div className="mt-3 space-y-1.5" aria-hidden>
          {[100, 85, 95, 60, 90, 75].map((l, i) => (
            <span key={i} className="block h-1.5 rounded-full bg-linha" style={{ width: `${l}%` }} />
          ))}
        </div>
      </div>
      <ArrowRight className="pulso hidden size-6 text-acao md:block" aria-hidden />
      <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-4">
        {cartoesDe(total, busca).map((c, i) => (
          <li key={c.ordem} style={atraso(i)} className="rag-voar rounded-md border bg-superficie p-2.5 shadow-caixa">
            <span className="font-mono text-xs font-bold text-tinta-2">Trecho {c.ordem + 1}</span>
            {c.texto ? (
              <span className="mt-1 line-clamp-3 text-xs text-tinta-2">{c.texto}</span>
            ) : (
              <span aria-hidden>
                <span className="mt-1.5 block h-1 rounded-full bg-linha" />
                <span className="mt-1 block h-1 w-3/4 rounded-full bg-linha" />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CenaNumeros({ total, busca }: { total: number; busca: Busca | null }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {cartoesDe(total, busca).map((c, i) => (
        <li key={c.ordem} style={atraso(i)} className="surgir space-y-2 rounded-md border bg-superficie p-2.5 shadow-caixa">
          <span className="font-mono text-xs font-bold text-tinta-2">Trecho {c.ordem + 1}</span>
          <Vetor semente={c.ordem + 1} />
        </li>
      ))}
    </ul>
  )
}

/** Barra de parecença real (0 a 100%), com o traço do mínimo para entrar, quando se sabe qual é. */
function Parecenca({ valor, limiar, atrasoMs }: { valor: number; limiar?: number; atrasoMs: number }) {
  const parte = Math.max(0, Math.min(1, valor))
  return (
    <div className="relative" role="img" aria-label={`Parecença com a pergunta: ${Math.round(parte * 100)}%`}>
      <div className="h-1.5 overflow-hidden rounded-full bg-linha">
        <span style={{ width: `${parte * 100}%`, animationDelay: `${atrasoMs}ms` }} className="rag-encher block h-full rounded-full bg-acao" />
      </div>
      {limiar !== undefined && <span style={{ left: `${limiar * 100}%` }} className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-tinta" aria-hidden />}
    </div>
  )
}

function CenaBuscar({ pergunta, total, resposta, busca }: { pergunta: Pergunta; total: number; resposta: Resposta; busca: Busca | null }) {
  const usados: Trecho[] = busca ? busca.trechos.filter((t) => t.situacao === 'usado') : resposta.trechos
  const deFora = busca ? busca.trechos.filter((t) => t.situacao !== 'usado') : []
  const quadrados = Math.min(total, MAX_QUADRADOS)
  const semNenhum = usados.length === 0
  // Os escolhidos entram depois da faixa de luz; os reprovados, depois deles.
  const inicioDeFora = 1400 + (usados.length + 1) * 280

  return (
    <div className="space-y-4">
      <div className="surgir flex flex-wrap items-center gap-x-4 gap-y-2 rounded-p border-[1.5px] border-acao bg-acao-suave p-3">
        <p className="min-w-0 flex-[3_1_18rem] font-medium">{pergunta.texto}</p>
        <Vetor semente={-7} className="flex-[1_1_8rem]" />
      </div>

      {/* A faixa de luz passa por todos os trechos: a busca compara a pergunta com cada um. */}
      <div className="relative overflow-hidden rounded-md" aria-hidden>
        <ul className="flex flex-wrap gap-1.5 py-1">
          {Array.from({ length: quadrados }, (_, i) => (
            <li
              key={i}
              style={i < usados.length ? { animationDelay: '1400ms' } : undefined}
              className={cn('size-5 rounded-sm border bg-superficie', i < usados.length && 'rag-acender')}
            />
          ))}
        </ul>
        <span className="rag-varrer pointer-events-none absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-[var(--acao)]/30 to-transparent" />
      </div>

      <p style={{ animationDelay: '1300ms' }} className="rag-cair text-xs text-tinta-2">
        A barra mostra o quanto o trecho se parece com a pergunta.{busca && ' O traço é o mínimo para entrar.'}
      </p>
      {semNenhum ? (
        <p style={{ animationDelay: '1400ms' }} className="rag-cair flex items-center gap-2 rounded-md border bg-superficie p-3 font-semibold">
          <SearchX className="size-5 text-tinta-2" aria-hidden /> Nenhum trecho passou do mínimo.
        </p>
      ) : (
        <ol className="space-y-2">
          {usados.map((t, i) => (
            <TrechoEscolhido key={i} trecho={t} n={i + 1} limiar={busca?.limiar} />
          ))}
        </ol>
      )}
      {busca && deFora.length > 0 && (
        <ListaDeFora trechos={deFora} total={busca.total} usados={usados.length} topK={busca.top_k} limiar={busca.limiar} inicio={inicioDeFora} />
      )}
    </div>
  )
}

function TrechoEscolhido({ trecho, n, limiar }: { trecho: Trecho; n: number; limiar?: number }) {
  const inicio = 1400 + n * 280
  return (
    <li style={{ animationDelay: `${inicio}ms` }} className="rag-cair grid gap-3 rounded-md border border-evidencia-tinta/40 bg-superficie p-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="rounded bg-evidencia px-1.5 font-mono">{n}</span>
          {trecho.documento}, página {trecho.pagina}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-tinta-2">{trecho.texto}</p>
      </div>
      <div className="space-y-2 self-center">
        <Vetor semente={n * 3} parecido={Math.max(0, Math.min(1, trecho.similaridade))} />
        <Parecenca valor={trecho.similaridade} limiar={limiar} atrasoMs={inicio + 200} />
      </div>
    </li>
  )
}

/** Os trechos que não entraram, com o texto de verdade e o motivo. */
function ListaDeFora({ trechos, total, usados, topK, limiar, inicio }: { trechos: TrechoNaBusca[]; total: number; usados: number; topK: number; limiar: number; inicio: number }) {
  const mostrados = trechos.slice(0, MAX_DE_FORA)
  const restantes = total - usados - mostrados.length
  return (
    <div className="space-y-1.5">
      <p style={{ animationDelay: `${inicio}ms` }} className="rag-cair text-sm font-semibold text-tinta-2">
        Ficaram de fora
      </p>
      <ul className="space-y-1.5">
        {mostrados.map((t, i) => {
          const atrasoMs = inicio + (i + 1) * 180
          return (
            <li key={t.ordem} style={{ animationDelay: `${atrasoMs}ms` }} className="rag-cair grid items-center gap-x-3 gap-y-1 rounded-md border border-dashed bg-superficie/60 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <div className="min-w-0">
                <p className="truncate text-sm text-tinta-2">{t.texto}</p>
                <p className="text-xs font-medium text-tinta-2">
                  {t.situacao === 'abaixo_do_minimo' ? 'Ficou antes do mínimo' : `Passou do mínimo, mas só entram os ${topK} melhores`}
                </p>
              </div>
              <Parecenca valor={t.similaridade} limiar={limiar} atrasoMs={atrasoMs + 150} />
            </li>
          )
        })}
      </ul>
      {restantes > 0 && (
        <p className="text-xs text-tinta-2">{restantes === 1 ? 'E mais 1 trecho, menos parecido.' : `E mais ${restantes} trechos, menos parecidos.`}</p>
      )}
    </div>
  )
}

function CenaPedido({ pergunta, resposta }: { pergunta: Pergunta; resposta: Resposta }) {
  const { trechos } = resposta
  if (resposta.nada_relevante)
    return (
      <div className="grid place-items-center text-center">
        <div className="surgir space-y-3">
          <Mail className="mx-auto size-12 text-tinta-2" aria-hidden />
          <p className="text-lg font-semibold">Nenhum pedido foi enviado à IA.</p>
        </div>
      </div>
    )

  const blocos = resposta.instrucoes_enviadas.split('\n\n')
  const regra = blocos[0]
  const orientacao = blocos.find((b) => b.startsWith('ORIENTAÇÃO DO ESTUDANTE:'))?.split('\n').slice(1).join(' ')

  return (
    <div className="mx-auto w-full max-w-3xl rounded-p border bg-superficie shadow-caixa">
      <p className="surgir flex items-center gap-2 border-b px-4 py-2.5 font-semibold">
        <Mail className="size-5 text-acao" aria-hidden /> O pedido que a IA recebe
      </p>
      <div className="space-y-3 p-4 text-sm">
        <Parte rotulo="A regra da plataforma" ordem={0}>
          {regra}
        </Parte>
        {orientacao && (
          <Parte rotulo="A sua orientação" ordem={1}>
            {orientacao}
          </Parte>
        )}
        <Parte rotulo="Os trechos das fontes" ordem={2}>
          <ol className="space-y-1.5">
            {trechos.map((t, i) => (
              <li key={i} style={{ animationDelay: `${1300 + i * 350}ms` }} className="rag-cair flex gap-2">
                <span className="h-fit rounded bg-evidencia px-1.5 font-mono font-bold text-tinta">{i + 1}</span>
                <span className="line-clamp-2 min-w-0">{t.texto}</span>
              </li>
            ))}
          </ol>
        </Parte>
        <Parte rotulo="A pergunta" ordem={3 + trechos.length * 0.6}>
          <span className="font-semibold text-tinta">{pergunta.texto}</span>
        </Parte>
      </div>
    </div>
  )
}

function Parte({ rotulo, ordem, children }: { rotulo: string; ordem: number; children: ReactNode }) {
  return (
    <section style={{ animationDelay: `${ordem * 600}ms` }} className="rag-cair">
      <h4 className="text-xs font-bold text-acao">{rotulo}</h4>
      <div className="mt-0.5 text-tinta-2">{children}</div>
    </section>
  )
}

function CenaResponder({ resposta }: { resposta: Resposta }) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          'surgir grid size-10 shrink-0 place-items-center rounded-full',
          resposta.nada_relevante ? 'border border-linha-forte bg-superficie text-tinta-2' : 'bg-acao text-acao-tinta',
        )}
        aria-hidden
      >
        {resposta.nada_relevante ? <SearchX className="size-5" /> : <Bot className="size-5" />}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <Digitando texto={resposta.texto} />
        {resposta.trechos.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-tinta-2">Trechos que a IA recebeu:</p>
            <ul className="flex flex-wrap gap-2 text-sm">
              {resposta.trechos.map((t, i) => (
                <li key={i} style={{ animationDelay: `${i * 150}ms` }} className="rag-cair inline-flex items-center gap-1.5 rounded-full border bg-superficie px-2.5 py-1">
                  <span className="rounded bg-evidencia px-1 font-mono text-xs font-bold">{i + 1}</span>
                  {t.documento} · p. {t.pagina}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/** A resposta aparece sendo escrita, em até uns 5 segundos. O texto inteiro fica disponível para leitor de tela. */
function Digitando({ texto }: { texto: string }) {
  const [mostrados, setMostrados] = useState(() => (semMovimento() ? texto.length : 0))
  useEffect(() => {
    if (mostrados >= texto.length) return
    const passo = Math.max(1, Math.ceil(texto.length / 240))
    const t = setTimeout(() => setMostrados((m) => Math.min(texto.length, m + passo)), 20)
    return () => clearTimeout(t)
  }, [mostrados, texto])
  const parcial = texto.slice(0, mostrados)

  return (
    <div className="rounded-caixa rounded-tl-md border bg-superficie px-4 py-3.5 shadow-caixa">
      <p className="sr-only">{texto}</p>
      <p aria-hidden className="whitespace-pre-line">
        {parcial.split(/(\[\d+\])/).map((parte, i) =>
          /^\[\d+\]$/.test(parte) ? (
            <span key={i} className="estalo mx-0.5 inline-block rounded bg-evidencia px-1 font-mono text-sm font-bold">
              {parte.slice(1, -1)}
            </span>
          ) : (
            parte
          ),
        )}
        {mostrados < texto.length && <span className="pulso ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-acao" />}
      </p>
    </div>
  )
}
