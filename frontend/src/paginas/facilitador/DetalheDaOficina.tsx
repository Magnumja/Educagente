import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Download, FileText, FileUp, MonitorUp, RefreshCw, Trash2, X } from 'lucide-react'
import { RespostaIA } from '@/components/RespostaIA'
import { Aviso, Botao, Caixa, Campo, Carregando, Segmentado, entradaCls } from '@/components/ui'
import { api, ErroApi, type LinhaRelatorio, type OficinaDetalhe, type Preferencia, type Veredito } from '@/lib/api'
import { navegar } from '@/lib/rota'
import { cn, plural } from '@/lib/utils'

type Aba = 'turma' | 'conteudo' | 'roteiro'

const VEREDITO: Record<Veredito, string> = { correta: 'correta', parcial: 'em parte', errada: 'errada', nao_sei: 'não sabe' }
const PREFERENCIA: Record<Preferencia, string> = { primeira: 'sem contexto', segunda: 'com fontes', nenhuma: 'nenhuma' }

export function DetalheDaOficina({ id, aoSessaoExpirar }: { id: number; aoSessaoExpirar: () => void }) {
  const [oficina, setOficina] = useState<OficinaDetalhe | null>(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<Aba>('turma')
  const [atualizando, setAtualizando] = useState(false)

  const carregar = useCallback(async () => {
    setAtualizando(true)
    try {
      setOficina(await api.facilitador.oficina(id))
      setErro('')
    } catch (e) {
      if ((e as ErroApi).status === 401) aoSessaoExpirar()
      else setErro((e as Error).message)
    } finally {
      setAtualizando(false)
    }
  }, [id, aoSessaoExpirar])

  useEffect(() => {
    carregar()
    // Atualiza sozinho enquanto a turma responde (só com a aba visível).
    const t = window.setInterval(() => document.visibilityState === 'visible' && carregar(), 20000)
    return () => window.clearInterval(t)
  }, [carregar])

  if (!oficina) return erro ? <Aviso tom="erro">{erro}</Aviso> : <Carregando />

  const executar = async (acao: () => Promise<unknown>) => {
    setErro('')
    try {
      await acao()
      await carregar()
    } catch (e) {
      if ((e as ErroApi).status === 401) aoSessaoExpirar()
      else setErro((e as Error).message)
    }
  }

  return (
    <div className="space-y-8">
      <Cabecalho oficina={oficina} executar={executar} />
      {erro && <Aviso tom="erro">{erro}</Aviso>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <Segmentado<Aba>
          legenda="Mostrar"
          compacto
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: 'turma', rotulo: `Respostas da turma (${oficina.total_participantes})` },
            { valor: 'conteudo', rotulo: 'Perguntas e fontes' },
            { valor: 'roteiro', rotulo: 'Roteiro da apresentação' },
          ]}
        />
        {aba === 'turma' && (
          <div className="flex flex-wrap gap-2">
            <Botao tamanho="p" variante="discreto" onClick={carregar} carregando={atualizando}>
              <RefreshCw className="size-4" aria-hidden /> Atualizar
            </Botao>
            <Botao tamanho="p" variante="secundario" onClick={() => executar(() => api.facilitador.baixarCsv(oficina.id, oficina.codigo))}>
              <Download className="size-4" aria-hidden /> Exportar CSV
            </Botao>
          </div>
        )}
      </div>

      {aba === 'turma' && <Turma oficina={oficina} executar={executar} />}
      {aba === 'conteudo' && <Conteudo oficina={oficina} executar={executar} />}
      {aba === 'roteiro' && <Roteiro />}

      <ApagarOficina oficina={oficina} executar={executar} />
    </div>
  )
}

type Executar = (acao: () => Promise<unknown>) => Promise<void>

function Cabecalho({ oficina, executar }: { oficina: OficinaDetalhe; executar: Executar }) {
  const link = `${window.location.origin}${window.location.pathname}#/entrar/${oficina.codigo}`
  const [copiado, setCopiado] = useState(false)
  const dialogo = useRef<HTMLDialogElement>(null)

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
          <Botao
            variante="secundario"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link)
                setCopiado(true)
                setTimeout(() => setCopiado(false), 2000)
              } catch {
                /* sem permissão: o link está visível no projetor */
              }
            }}
          >
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

function Turma({ oficina, executar }: { oficina: OficinaDetalhe; executar: Executar }) {
  if (oficina.relatorio.length === 0)
    return (
      <Caixa className="space-y-2">
        <p className="font-semibold">Ninguém entrou ainda.</p>
        <p className="text-tinta-2">Mostre o código no projetor. As respostas aparecem aqui e a tela se atualiza sozinha.</p>
      </Caixa>
    )

  return (
    <div className="space-y-8">
      <Resumo oficina={oficina} />
      <section aria-labelledby="participantes" className="space-y-3">
        <h2 id="participantes" className="text-xl font-semibold">
          Por participante
        </h2>
        <ul className="space-y-2">
          {oficina.relatorio.map((linha) => (
            <Participante key={linha.id} linha={linha} oficina={oficina} executar={executar} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function Resumo({ oficina }: { oficina: OficinaDetalhe }) {
  return (
    <section aria-labelledby="resumo" className="space-y-3">
      <h2 id="resumo" className="text-xl font-semibold">
        Resumo por pergunta
      </h2>
      <div className="overflow-x-auto rounded-caixa border bg-superficie">
        <table className="w-full min-w-[44rem] text-left text-[0.95rem]">
          <thead className="border-b bg-superficie-2 text-sm">
            <tr>
              <th scope="col" className="p-3">Pergunta</th>
              <th scope="col" className="p-3">Fizeram as 2 tentativas</th>
              <th scope="col" className="p-3">Avaliaram</th>
              <th scope="col" className="p-3">Confiaram mais em</th>
              <th scope="col" className="p-3">“Nada nas fontes”</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {oficina.perguntas.map((q, i) => {
              const itens = oficina.relatorio.map((l) => l.perguntas[i])
              const ambas = itens.filter((x) => x?.primeira && x?.segunda).length
              const avaliacoes = itens.map((x) => x?.avaliacao).filter(Boolean)
              const conta = (p: Preferencia) => avaliacoes.filter((a) => a!.mais_confiavel === p).length
              const nada = itens.filter((x) => x?.segunda?.nada_relevante).length
              return (
                <tr key={q.id} className="align-top">
                  <td className="p-3 font-medium">
                    {q.ordem}. {q.texto}
                  </td>
                  <td className="p-3 tabular-nums">{ambas}</td>
                  <td className="p-3 tabular-nums">{avaliacoes.length}</td>
                  <td className="p-3">
                    {avaliacoes.length === 0
                      ? '—'
                      : `com fontes ${conta('segunda')} · sem contexto ${conta('primeira')} · nenhuma ${conta('nenhuma')}`}
                  </td>
                  <td className="p-3 tabular-nums">{nada}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Participante({ linha, oficina, executar }: { linha: LinhaRelatorio; oficina: OficinaDetalhe; executar: Executar }) {
  const [confirmando, setConfirmando] = useState(false)
  const feitas = linha.perguntas.filter((p) => p.primeira && p.segunda).length
  const avaliadas = linha.perguntas.filter((p) => p.avaliacao).length
  return (
    <li>
      <details className="group rounded-caixa border bg-superficie">
        <summary className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4 hover:bg-superficie-2">
          <span className="mr-auto font-semibold">{linha.apelido}</span>
          <span className="text-sm text-tinta-2">{plural(linha.fontes.length, 'fonte')}</span>
          <span className="text-sm text-tinta-2">{feitas}/3 comparadas</span>
          <span className="text-sm text-tinta-2">{avaliadas}/3 avaliadas</span>
        </summary>
        <div className="space-y-6 border-t p-4">
          {linha.orientacao && (
            <p>
              <span className="font-semibold">Orientação dada à IA:</span> <span className="text-tinta-2">{linha.orientacao}</span>
            </p>
          )}
          {linha.fontes.length > 0 && (
            <p>
              <span className="font-semibold">Fontes:</span> <span className="text-tinta-2">{linha.fontes.join('; ')}</span>
            </p>
          )}
          {linha.perguntas.map((item, i) => (
            <div key={item.pergunta_id} className="space-y-3">
              <h3 className="font-semibold">
                {i + 1}. {oficina.perguntas[i]?.texto}
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {[item.primeira, item.segunda].map((r, j) => (
                  <div key={j} className={cn('rounded-p border p-3', j === 0 && 'border-dashed')}>
                    {r ? <RespostaIA resposta={r} compacta /> : <p className="text-sm text-tinta-2">Ainda não perguntou.</p>}
                  </div>
                ))}
              </div>
              {item.avaliacao && (
                <p className="text-sm">
                  Avaliou a sem contexto como <strong>{VEREDITO[item.avaliacao.primeira]}</strong>, a com fontes como{' '}
                  <strong>{VEREDITO[item.avaliacao.segunda]}</strong> e confiaria mais em{' '}
                  <strong>{PREFERENCIA[item.avaliacao.mais_confiavel]}</strong>
                  {item.avaliacao.conferiu_fonte ? '; conferiu a fonte' : '; não conferiu a fonte'}.
                  {item.avaliacao.observacao && <span className="text-tinta-2"> “{item.avaliacao.observacao}”</span>}
                </p>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            {confirmando ? (
              <>
                <span className="font-semibold">Apagar todos os dados de {linha.apelido}?</span>
                <Botao tamanho="p" variante="perigo" onClick={() => executar(() => api.facilitador.apagarParticipante(oficina.id, linha.id))}>
                  Sim, apagar
                </Botao>
                <Botao tamanho="p" variante="discreto" onClick={() => setConfirmando(false)}>
                  Cancelar
                </Botao>
              </>
            ) : (
              <Botao tamanho="p" variante="discreto" onClick={() => setConfirmando(true)}>
                <Trash2 className="size-4" aria-hidden /> Apagar dados deste participante
              </Botao>
            )}
          </div>
        </div>
      </details>
    </li>
  )
}

function Conteudo({ oficina, executar }: { oficina: OficinaDetalhe; executar: Executar }) {
  const [perguntas, setPerguntas] = useState(oficina.perguntas.map(({ texto, referencia }) => ({ texto, referencia })))
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const mudou = perguntas.some((p, i) => p.texto !== oficina.perguntas[i].texto || p.referencia !== oficina.perguntas[i].referencia)

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section aria-labelledby="perguntas" className="space-y-4">
        <h2 id="perguntas" className="text-xl font-semibold">
          As três perguntas
        </h2>
        <p className="text-sm text-tinta-2">Depois que alguém responde, o texto da pergunta não muda mais (só a referência).</p>
        {perguntas.map((p, i) => (
          <fieldset key={i} className="space-y-3 rounded-caixa border bg-superficie p-4">
            <legend className="px-1 font-semibold">Pergunta {i + 1}</legend>
            <Campo rotulo="Texto">
              {(props) => (
                <input
                  {...props}
                  value={p.texto}
                  maxLength={300}
                  onChange={(e) => setPerguntas((ps) => ps.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
                  className={entradaCls}
                />
              )}
            </Campo>
            <Campo rotulo="Resposta de referência">
              {(props) => (
                <textarea
                  {...props}
                  value={p.referencia}
                  rows={3}
                  maxLength={3000}
                  onChange={(e) => setPerguntas((ps) => ps.map((x, j) => (j === i ? { ...x, referencia: e.target.value } : x)))}
                  className={cn(entradaCls, 'resize-y')}
                />
              )}
            </Campo>
          </fieldset>
        ))}
        <Botao
          variante="primario"
          disabled={!mudou}
          carregando={salvando}
          onClick={async () => {
            setSalvando(true)
            await executar(() => api.facilitador.atualizar(oficina.id, { perguntas }))
            setSalvando(false)
          }}
        >
          Salvar perguntas
        </Botao>
      </section>

      <section aria-labelledby="fontes" className="space-y-4">
        <h2 id="fontes" className="text-xl font-semibold">
          Fontes sugeridas
        </h2>
        <p className="text-sm text-tinta-2">
          Os participantes podem colocar estas fontes na base deles com um clique na etapa 2. Use materiais que você conferiu.
        </p>
        {oficina.fontes.length > 0 ? (
          <ul className="divide-y rounded-caixa border bg-superficie">
            {oficina.fontes.map((f) => (
              <li key={f.id} className="flex items-center gap-3 p-3">
                <FileText className="size-5 shrink-0 text-tinta-2" aria-hidden />
                <span className="mr-auto min-w-0">
                  <span className="block truncate font-semibold">{f.nome}</span>
                  <span className="text-sm text-tinta-2">
                    {plural(f.paginas, 'página')} · {plural(f.trechos, 'trecho')}
                  </span>
                </span>
                <Botao
                  tamanho="p"
                  variante="discreto"
                  aria-label={`Remover ${f.nome}`}
                  onClick={() => executar(() => api.facilitador.removerFonte(oficina.id, f.id))}
                >
                  <Trash2 className="size-4" aria-hidden /> Remover
                </Botao>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-caixa border border-dashed p-4 text-tinta-2">Nenhuma fonte sugerida.</p>
        )}
        <div className="space-y-3 rounded-caixa border bg-superficie p-4">
          <label className="block font-semibold" htmlFor="fonte-facilitador">
            Enviar PDF ou TXT
          </label>
          <input
            id="fonte-facilitador"
            ref={entrada}
            type="file"
            accept=".pdf,.txt"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:min-h-9 file:rounded-p file:border-[1.5px] file:border-linha-forte file:bg-superficie-2 file:px-3 file:font-semibold"
          />
          <Botao
            variante="primario"
            disabled={!arquivo}
            carregando={enviando}
            onClick={async () => {
              if (!arquivo) return
              setEnviando(true)
              await executar(() => api.facilitador.enviarFonte(oficina.id, arquivo))
              setEnviando(false)
              setArquivo(null)
              if (entrada.current) entrada.current.value = ''
            }}
          >
            <FileUp className="size-4" aria-hidden /> Adicionar fonte
          </Botao>
        </div>
      </section>
    </div>
  )
}

const ROTEIRO = [
  { tempo: '1–2 min', titulo: 'O problema', texto: 'Muita gente usa IA para estudar sem conferir fontes nem a correção das respostas.' },
  { tempo: '3–5 min', titulo: 'Demonstração', texto: 'As três etapas na plataforma: sem contexto, com fontes e a comparação lado a lado.' },
  { tempo: '2 min', titulo: 'O que é RAG', texto: 'A diferença entre dar contexto e recuperar trechos de documentos (página “Como a IA usa fontes”).' },
  { tempo: '1–2 min', titulo: 'NotebookLM', texto: 'O mesmo raciocínio aplicado ao estudo, e os cuidados de verificação que continuam valendo.' },
]

function Roteiro() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <section aria-labelledby="roteiro" className="space-y-3">
        <h2 id="roteiro" className="text-xl font-semibold">
          Apresentação de 10 minutos
        </h2>
        <ol className="divide-y rounded-caixa border bg-superficie">
          {ROTEIRO.map((r) => (
            <li key={r.titulo} className="grid grid-cols-[5.5rem_1fr] gap-4 p-4">
              <span className="font-mono text-sm font-semibold text-tinta-2">{r.tempo}</span>
              <span>
                <span className="block font-semibold">{r.titulo}</span>
                <span className="text-tinta-2">{r.texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="cuidados" className="space-y-3">
        <h2 id="cuidados" className="text-xl font-semibold">
          Antes de começar
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-tinta-2">
          <li>Teste as três perguntas com o modelo configurado: não dá para supor que a etapa 1 sempre erra nem que a 3 sempre acerta.</li>
          <li>Tenha a resposta de referência com a fonte para cada pergunta.</li>
          <li>Só use estatísticas na fala se tiver a fonte (por exemplo, percentuais de uso de IA por jovens).</li>
          <li>Se a IA responder algo inesperado, use isso na discussão: é exatamente o ponto da oficina.</li>
          <li>Feche a oficina para novos participantes quando a turma inteira tiver entrado.</li>
        </ul>
      </section>
    </div>
  )
}

function ApagarOficina({ oficina, executar }: { oficina: OficinaDetalhe; executar: Executar }) {
  const [confirmando, setConfirmando] = useState(false)
  return (
    <div className="border-t pt-6">
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">
            Apagar a oficina e os dados de {plural(oficina.total_participantes, 'participante')}? Não dá para desfazer.
          </span>
          <Botao
            variante="perigo"
            onClick={() =>
              executar(async () => {
                await api.facilitador.apagar(oficina.id)
                navegar('/facilitador')
              })
            }
          >
            Sim, apagar a oficina
          </Botao>
          <Botao variante="discreto" onClick={() => setConfirmando(false)}>
            Cancelar
          </Botao>
        </div>
      ) : (
        <Botao variante="discreto" onClick={() => setConfirmando(true)}>
          <Trash2 className="size-4" aria-hidden /> Apagar esta oficina
        </Botao>
      )}
    </div>
  )
}
