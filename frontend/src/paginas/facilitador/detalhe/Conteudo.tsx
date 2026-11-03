/**
 * Aba "Perguntas e fontes": edita o texto e a resposta de referência das três perguntas
 * (PATCH /facilitador/oficinas/{id}) e gerencia as fontes sugeridas à turma
 * (POST/DELETE /facilitador/oficinas/{id}/fontes).
 */
import { useRef, useState } from 'react'
import { FileText, FileUp, Trash2 } from 'lucide-react'
import { entradaCls } from '@/components/classes'
import { Botao, Campo } from '@/components/ui'
import { api } from '@/lib/api'
import { cn, plural } from '@/lib/utils'
import type { PropsDaParte } from './tipos'

type Rascunho = { texto: string; referencia: string }

export function Conteudo({ oficina, executar }: PropsDaParte) {
  // Rascunho local das perguntas: só vai ao servidor ao clicar em "Salvar perguntas".
  const [perguntas, setPerguntas] = useState<Rascunho[]>(oficina.perguntas.map(({ texto, referencia }) => ({ texto, referencia })))
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const mudou = perguntas.some((p, i) => p.texto !== oficina.perguntas[i].texto || p.referencia !== oficina.perguntas[i].referencia)

  const mudarPergunta = (i: number, campo: keyof Rascunho, valor: string) =>
    setPerguntas((ps) => ps.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)))

  async function salvarPerguntas() {
    setSalvando(true)
    await executar(() => api.facilitador.atualizar(oficina.id, { perguntas }))
    setSalvando(false)
  }

  async function enviarFonte() {
    if (!arquivo) return
    setEnviando(true)
    await executar(() => api.facilitador.enviarFonte(oficina.id, arquivo))
    setEnviando(false)
    setArquivo(null)
    if (entrada.current) entrada.current.value = ''
  }

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
                <input {...props} value={p.texto} maxLength={300} onChange={(e) => mudarPergunta(i, 'texto', e.target.value)} className={entradaCls} />
              )}
            </Campo>
            <Campo rotulo="Resposta de referência">
              {(props) => (
                <textarea
                  {...props}
                  value={p.referencia}
                  rows={3}
                  maxLength={3000}
                  onChange={(e) => mudarPergunta(i, 'referencia', e.target.value)}
                  className={cn(entradaCls, 'resize-y')}
                />
              )}
            </Campo>
          </fieldset>
        ))}
        <Botao variante="primario" disabled={!mudou} carregando={salvando} onClick={salvarPerguntas}>
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
          <Botao variante="primario" disabled={!arquivo} carregando={enviando} onClick={enviarFonte}>
            <FileUp className="size-4" aria-hidden /> Adicionar fonte
          </Botao>
        </div>
      </section>
    </div>
  )
}
