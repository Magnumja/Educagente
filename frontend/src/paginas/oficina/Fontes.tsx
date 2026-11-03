import { useRef, useState, type CSSProperties, type DragEvent, type FormEvent } from 'react'
import { Check, FileText, FileUp, Library, Lightbulb, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { Aviso, Botao, Caixa, Campo, Dica, NumeroDoPasso, Segmentado, entradaCls } from '@/components/ui'
import { api, type Documento } from '@/lib/api'
import { usePreferencias } from '@/lib/preferencias'
import { cn, plural } from '@/lib/utils'
import { Avancar, CabecalhoEtapa, type PropsEtapa } from '../Oficina'

const ORIGEM: Record<Documento['origem'], string> = {
  enviado: 'arquivo enviado',
  colado: 'texto colado',
  sugerido: 'sugerida pelo facilitador',
}

const SUGESTOES_DE_ORIENTACAO = [
  'Explique como para alguém de 15 anos.',
  'Responda em até três frases.',
  'Se as fontes não tiverem a resposta, diga isso.',
  'Termine com uma pergunta para eu pensar.',
]

export function Fontes({ estado, recarregar }: PropsEtapa) {
  const { prefs } = usePreferencias()
  const [mensagem, setMensagem] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function executar(chave: string, acao: () => Promise<unknown>, sucesso: string) {
    setOcupado(chave)
    setMensagem(null)
    try {
      await acao()
      await recarregar()
      setMensagem({ tom: 'ok', texto: sucesso })
    } catch (e) {
      setMensagem({ tom: 'erro', texto: (e as Error).message })
    } finally {
      setOcupado(null)
    }
  }

  const naBase = new Set(estado.documentos.map((d) => d.copia_de_id).filter(Boolean))

  return (
    <div>
      <CabecalhoEtapa n={2}>
        <p>
          Dê à IA <strong>materiais confiáveis</strong> para consultar: livro didático, material do professor, site oficial.
        </p>
      </CabecalhoEtapa>

      <div className="space-y-8">
        <SuaBase
          documentos={estado.documentos}
          ocupado={ocupado}
          aoRemover={(d) => executar(`r${d.id}`, () => api.removerDocumento(d.id), `“${d.nome}” saiu da sua base.`)}
        />
        <div className="space-y-8">
          <Caixa className="space-y-6">
            <div className="flex items-start gap-4">
              <NumeroDoPasso n={1} />
              <div>
                <h2 className="text-xl font-semibold">Escolha suas fontes</h2>
                <p className="text-tinta-2">Pode usar uma das sugeridas, enviar um arquivo ou colar um texto.</p>
              </div>
            </div>

            {estado.fontes_sugeridas.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-tinta-2">Sugeridas pelo facilitador</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {estado.fontes_sugeridas.map((f, i) => {
                    const adicionada = naBase.has(f.id)
                    return (
                      <li
                        key={f.id}
                        style={{ '--i': i } as CSSProperties}
                        className={cn(
                          'surgir flex flex-col gap-3 rounded-caixa border-[1.5px] p-4 transition-colors',
                          adicionada ? 'border-ok/50 bg-ok-fundo' : 'levanta bg-superficie',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-acao-suave text-acao" aria-hidden>
                            <FileText className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{f.nome}</p>
                            <p className="text-sm text-tinta-2">
                              {plural(f.paginas, 'página')} · {plural(f.trechos, 'trecho')}
                            </p>
                          </div>
                        </div>
                        {adicionada ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok">
                            <Check className="estalo size-4" aria-hidden /> Está na sua base
                          </span>
                        ) : (
                          <Botao
                            tamanho="p"
                            variante="primario"
                            className="self-start"
                            carregando={ocupado === `s${f.id}`}
                            disabled={!!ocupado}
                            onClick={() => executar(`s${f.id}`, () => api.usarFonteSugerida(f.id), `“${f.nome}” entrou na sua base.`)}
                          >
                            <Plus className="size-4" aria-hidden /> Usar esta fonte
                          </Botao>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <AdicionarPropria ocupado={ocupado} executar={executar} temSugeridas={estado.fontes_sugeridas.length > 0} />

            {mensagem && <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso>}
          </Caixa>

          <Orientacao inicial={estado.orientacao} recarregar={recarregar} />

          <Dica Icone={Lightbulb} titulo="Anexar um documento é o mesmo que RAG?">
            Não exatamente. Anexar e dar instruções é <strong>dar contexto</strong>. Aqui a plataforma vai além: corta suas
            fontes em trechos, procura os mais parecidos com cada pergunta e entrega só esses à IA. Isso é{' '}
            <strong>RAG</strong>.
            {prefs.detalhe === 'tecnico' &&
              ' Cada trecho vira um vetor de números (embedding); a busca compara o vetor da pergunta com os dos trechos pela similaridade de cosseno.'}
          </Dica>
        </div>
      </div>

      <Avancar para={3} rotulo="Perguntar de novo" liberado={estado.documentos.length > 0} motivo="Adicione pelo menos uma fonte." />
    </div>
  )
}

function AdicionarPropria({
  ocupado,
  executar,
  temSugeridas,
}: {
  ocupado: string | null
  executar: (chave: string, acao: () => Promise<unknown>, sucesso: string) => Promise<void>
  temSugeridas: boolean
}) {
  const [modo, setModo] = useState<'arquivo' | 'texto'>('arquivo')
  return (
    <div className="space-y-4">
      {temSugeridas && (
        <div className="flex items-center gap-3 text-sm text-tinta-2" aria-hidden>
          <span className="h-px flex-1 bg-linha" /> ou adicione uma sua <span className="h-px flex-1 bg-linha" />
        </div>
      )}
      <Segmentado<'arquivo' | 'texto'>
        legenda="Como você quer adicionar?"
        compacto
        valor={modo}
        aoMudar={setModo}
        opcoes={[
          { valor: 'arquivo', rotulo: 'Enviar arquivo PDF ou TXT' },
          { valor: 'texto', rotulo: 'Colar um texto' },
        ]}
      />
      <div key={modo} className="surgir">
        {modo === 'arquivo' ? (
          <EnviarArquivo
            ocupado={ocupado === 'arquivo'}
            aoEnviar={(arquivo) => executar('arquivo', () => api.enviarArquivo(arquivo), `“${arquivo.name}” entrou na sua base.`)}
          />
        ) : (
          <ColarTexto
            ocupado={ocupado === 'texto'}
            aoEnviar={(titulo, texto) => executar('texto', () => api.colarTexto(titulo, texto), `“${titulo}” entrou na sua base.`)}
          />
        )}
      </div>
      <p className="flex items-start gap-2 text-sm text-tinta-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-alerta" aria-hidden />
        <span>
          <strong className="text-tinta">Não envie dados pessoais</strong> (nome completo, CPF, endereço, fotos de pessoas).
        </span>
      </p>
    </div>
  )
}

function EnviarArquivo({ ocupado, aoEnviar }: { ocupado: boolean; aoEnviar: (f: File) => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  function soltar(e: DragEvent) {
    e.preventDefault()
    setArrastando(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setArquivo(f)
  }

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={soltar}
        className={cn(
          'flex min-h-36 flex-col items-center justify-center gap-2 rounded-caixa border-2 border-dashed p-6 text-center transition-[background-color,border-color,transform] duration-200',
          'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-foco',
          arrastando ? 'scale-[1.01] border-acao bg-acao-suave' : 'border-linha-forte bg-superficie-2/50 hover:border-acao/60 hover:bg-acao-suave/50',
        )}
      >
        <span className="grid size-11 place-items-center rounded-full bg-superficie text-acao shadow-caixa" aria-hidden>
          <FileUp className="size-5" />
        </span>
        <span className="font-semibold">{arquivo ? arquivo.name : 'Escolher um PDF ou TXT'}</span>
        <span className="text-sm text-tinta-2">ou arraste o arquivo para cá · até 5 MB</span>
        <input
          ref={entrada}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          className="sr-only"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-2">PDF escaneado (foto de página) não tem texto: nesse caso, cole o texto.</p>
        <Botao
          variante="primario"
          disabled={!arquivo}
          carregando={ocupado}
          onClick={() => {
            if (!arquivo) return
            aoEnviar(arquivo)
            setArquivo(null)
            if (entrada.current) entrada.current.value = ''
          }}
        >
          {ocupado ? 'Lendo e cortando em trechos…' : 'Adicionar à minha base'}
        </Botao>
      </div>
    </div>
  )
}

function ColarTexto({ ocupado, aoEnviar }: { ocupado: boolean; aoEnviar: (titulo: string, texto: string) => void }) {
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [tentou, setTentou] = useState(false)
  const curto = texto.trim().length < 20

  function enviar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!titulo.trim() || curto) return
    aoEnviar(titulo.trim(), texto)
    setTitulo('')
    setTexto('')
    setTentou(false)
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <Campo
        rotulo="De onde é esse texto?"
        dica="Ex.: Livro de História, cap. 3"
        erro={tentou && !titulo.trim() ? 'Dê um nome à fonte, para saber de onde veio cada trecho.' : undefined}
      >
        {(p) => <input {...p} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} className={entradaCls} />}
      </Campo>
      <Campo
        rotulo="Texto"
        dica={`${texto.length.toLocaleString('pt-BR')} de 20.000 caracteres`}
        erro={tentou && curto ? 'Cole pelo menos uma ou duas frases.' : undefined}
      >
        {(p) => (
          <textarea {...p} value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} maxLength={20000} className={cn(entradaCls, 'resize-y')} />
        )}
      </Campo>
      <div className="flex justify-end">
        <Botao type="submit" variante="primario" carregando={ocupado}>
          Adicionar à minha base
        </Botao>
      </div>
    </form>
  )
}

function SuaBase({ documentos, ocupado, aoRemover }: { documentos: Documento[]; ocupado: string | null; aoRemover: (d: Documento) => void }) {
  return (
    <aside aria-labelledby="base">
      <Caixa as="div" className="space-y-4 border-evidencia-tinta/30">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-evidencia text-tinta" aria-hidden>
            <Library className="size-5" />
          </span>
          <div>
            <h2 id="base" className="font-semibold">
              Sua base de fontes
            </h2>
            <p className="text-sm text-tinta-2">{documentos.length === 0 ? 'Vazia por enquanto' : plural(documentos.length, 'fonte')}</p>
          </div>
        </div>
        {documentos.length === 0 ? (
          <p className="rounded-p border border-dashed p-4 text-sm text-tinta-2">
            A IA só vai consultar o que estiver aqui. Adicione pelo menos uma fonte.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {documentos.map((d, i) => (
              <li key={d.id} style={{ '--i': i } as CSSProperties} className="surgir flex items-center gap-2 rounded-p border bg-superficie-2/50 p-3">
                <div className="mr-auto min-w-0">
                  <p className="truncate text-sm font-semibold">{d.nome}</p>
                  <p className="text-xs text-tinta-2">
                    {ORIGEM[d.origem]} · {plural(d.trechos, 'trecho')}
                  </p>
                </div>
                <Botao
                  tamanho="p"
                  variante="discreto"
                  aria-label={`Remover ${d.nome}`}
                  title="Remover"
                  carregando={ocupado === `r${d.id}`}
                  disabled={!!ocupado}
                  onClick={() => aoRemover(d)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Caixa>
    </aside>
  )
}

function Orientacao({ inicial, recarregar }: { inicial: string; recarregar: () => Promise<void> }) {
  const [texto, setTexto] = useState(inicial)
  const [estado, setEstado] = useState<'parado' | 'salvando' | 'salvo' | 'erro'>('parado')
  const mudou = texto.trim() !== inicial.trim()

  async function salvar() {
    setEstado('salvando')
    try {
      await api.salvarOrientacao(texto)
      await recarregar()
      setEstado('salvo')
    } catch {
      setEstado('erro')
    }
  }

  return (
    <Caixa className="space-y-5">
      <div className="flex items-start gap-4">
        <NumeroDoPasso n={2} />
        <div>
          <h2 className="text-xl font-semibold">
            Diga como quer a resposta <span className="text-base font-normal text-tinta-2">(opcional)</span>
          </h2>
          <p className="text-tinta-2">Essa orientação vai junto com os trechos na etapa 3.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Sugestões de orientação">
        {SUGESTOES_DE_ORIENTACAO.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setTexto((t) => (t.trim() ? `${t.trim()} ${s}` : s).slice(0, 800))
              setEstado('parado')
            }}
            className="rounded-full border border-linha-forte bg-superficie px-3 py-1.5 text-sm transition-[background-color,border-color,transform] duration-200 hover:border-acao hover:bg-acao-suave active:scale-95"
          >
            + {s}
          </button>
        ))}
      </div>
      <Campo rotulo="Sua orientação" dica={`${texto.length} de 800 caracteres. Ela muda o jeito de responder, não os fatos.`}>
        {(p) => (
          <textarea
            {...p}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setEstado('parado')
            }}
            rows={3}
            maxLength={800}
            placeholder="Ex.: Explique com um exemplo do dia a dia."
            className={cn(entradaCls, 'resize-y')}
          />
        )}
      </Campo>
      <div className="flex flex-wrap items-center gap-3">
        <Botao variante="secundario" onClick={salvar} disabled={!mudou} carregando={estado === 'salvando'}>
          Salvar orientação
        </Botao>
        <span role="status" className="text-sm text-tinta-2">
          {estado === 'salvo' && !mudou && (
            <span className="inline-flex items-center gap-1 font-semibold text-ok">
              <Check className="estalo size-4" aria-hidden /> Salva.
            </span>
          )}
          {estado === 'erro' && <span className="text-erro">Não deu para salvar. Tente de novo.</span>}
          {mudou && estado === 'parado' && 'Alterações ainda não salvas.'}
        </span>
      </div>
    </Caixa>
  )
}
