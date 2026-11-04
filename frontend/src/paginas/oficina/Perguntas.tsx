/**
 * Etapas 1 e 3 (a mesma tela, mudando a tentativa). Lista as três perguntas da oficina e
 * pede à IA uma resposta para cada: tentativa 1 sem contexto, tentativa 2 com as fontes
 * do participante (RAG no servidor). Enquanto espera mostra o Escrevendo; depois, a RespostaIA.
 */
import { useState } from 'react'
import { BookMarked, Brain, ChevronDown, MousePointerClick, Play, RotateCcw, Sparkles, Workflow } from 'lucide-react'
import { CaminhoRag } from '@/components/CaminhoRag'
import { Avancar, CabecalhoEtapa, type PropsEtapa } from '@/components/Etapa'
import { Escrevendo, RespostaIA } from '@/components/RespostaIA'
import { Aviso, Botao, Caixa, Dica, NumeroDoPasso } from '@/components/ui'
import { api, textoDoErro, type Pergunta, type Tentativa } from '@/lib/api'
import { respostaDe } from '@/lib/etapas'
import { href } from '@/lib/rota'
import { atraso } from '@/lib/utils'

export function Perguntas({ estado, recarregar, tentativa }: PropsEtapa & { tentativa: Tentativa }) {
  // Só um esquema aberto por vez: a página não fica enorme com três animações.
  // Sem escolha da pessoa (undefined), abre sozinho na primeira pergunta já respondida com fontes.
  const [escolhaDeMontagem, setEscolhaDeMontagem] = useState<number | null>()
  // Perguntas esperando resposta da IA agora (pode haver mais de uma) e o erro de cada uma.
  const [pendentes, setPendentes] = useState<Set<number>>(new Set())
  const [erros, setErros] = useState<Record<number, string>>({})
  const [emLote, setEmLote] = useState(false)

  const resposta = (p: Pergunta, t: Tentativa) => respostaDe(estado, p.id, t)
  // Na etapa 3 só dá para perguntar com fontes na base e com a etapa 1 completa (para comparar depois).
  const semBase = tentativa === 2 && estado.documentos.length === 0
  const faltamPrimeiras = tentativa === 2 && estado.perguntas.some((p) => !resposta(p, 1))
  const bloqueado = semBase || faltamPrimeiras
  const respondidas = estado.perguntas.filter((p) => resposta(p, tentativa)).length
  const total = estado.perguntas.length
  const completo = respondidas === total
  const montagemAberta = escolhaDeMontagem !== undefined ? escolhaDeMontagem : estado.perguntas.find((p) => respostaDe(estado, p.id, 2))?.id

  /** POST /eu/perguntar e depois recarregar(): a resposta nova chega pelo estado, não pelo retorno. */
  async function perguntar(p: Pergunta) {
    setPendentes((s) => new Set(s).add(p.id))
    setErros((er) => Object.fromEntries(Object.entries(er).filter(([k]) => Number(k) !== p.id)))
    try {
      await api.perguntar(p.id, tentativa)
      await recarregar()
    } catch (e) {
      setErros((er) => ({ ...er, [p.id]: textoDoErro(e) }))
    } finally {
      setPendentes((s) => {
        const novo = new Set(s)
        novo.delete(p.id)
        return novo
      })
    }
  }

  async function perguntarTodas() {
    setEmLote(true)
    // Uma de cada vez: o servidor da turma atende muita gente ao mesmo tempo.
    for (const p of estado.perguntas) if (!resposta(p, tentativa)) await perguntar(p)
    setEmLote(false)
  }

  return (
    <div>
      {tentativa === 1 ? (
        <CabecalhoEtapa n={1}>
          <p>
            Faça as três perguntas a uma IA <strong>sem nenhum material</strong>. Ela só conta com o que aprendeu no treino.
          </p>
        </CabecalhoEtapa>
      ) : (
        <CabecalhoEtapa n={3}>
          <p>
            As <strong>mesmas três perguntas</strong>, agora com as suas fontes. Veja o que muda.
          </p>
        </CabecalhoEtapa>
      )}

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {tentativa === 1 ? (
          <>
            <Dica Icone={Brain} titulo="Como essa IA responde" style={atraso(0)}>
              Ela escreve o que <strong>parece mais provável</strong>. Uma resposta bonita e segura pode estar errada.
            </Dica>
            <Dica Icone={Sparkles} titulo="Seu papel aqui" style={atraso(1)}>
              Só leia com atenção. Você vai conferir essas respostas na etapa 4.
            </Dica>
          </>
        ) : (
          <>
            <Dica Icone={BookMarked} titulo="O que acontece por trás" style={atraso(0)}>
              A plataforma procura nas suas fontes os trechos <strong>mais parecidos</strong> com a pergunta e entrega só
              esses à IA.
            </Dica>
            <Dica Icone={MousePointerClick} titulo="Confira você mesmo" style={atraso(1)}>
              Toque nos números amarelos da resposta para ler o trecho de onde veio a informação.
            </Dica>
          </>
        )}
      </div>

      {semBase && (
        <Aviso tom="alerta" titulo="Sua base de fontes está vazia" className="mb-6">
          Adicione pelo menos uma fonte na{' '}
          <a href={href('/oficina/2')} className="font-semibold text-acao underline underline-offset-4">
            etapa 2
          </a>{' '}
          antes de perguntar de novo.
        </Aviso>
      )}
      {!semBase && faltamPrimeiras && (
        <Aviso tom="alerta" titulo="Faltam perguntas da etapa 1" className="mb-6">
          Para comparar depois, cada pergunta precisa ser feita primeiro sem contexto.{' '}
          <a href={href('/oficina/1')} className="font-semibold text-acao underline underline-offset-4">
            Voltar para a etapa 1
          </a>
        </Aviso>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          Perguntas <span className="font-normal text-tinta-2">· {respondidas} de {total} respondidas</span>
        </h2>
        {!completo && !bloqueado && (
          <Botao variante="primario" onClick={perguntarTodas} carregando={emLote} disabled={pendentes.size > 0 && !emLote}>
            <Play className="size-4" aria-hidden /> {respondidas === 0 ? 'Fazer as três perguntas' : 'Fazer as que faltam'}
          </Botao>
        )}
      </div>

      <ol className="space-y-6">
        {estado.perguntas.map((p, i) => {
          const r = resposta(p, tentativa)
          const anterior = tentativa === 2 ? resposta(p, 1) : undefined
          const pendente = pendentes.has(p.id)
          return (
            <Caixa as="li" key={p.id} className="surgir space-y-5" style={atraso(i)}>
              <div className="flex flex-wrap items-start gap-4">
                <NumeroDoPasso n={p.ordem} tom={r ? 'ok' : 'acao'} />
                <h3 className="min-w-0 flex-1 pt-1 text-xl font-semibold leading-snug">{p.texto}</h3>
                {r && !pendente && (
                  <Botao tamanho="p" variante="discreto" onClick={() => perguntar(p)} disabled={bloqueado || emLote}>
                    <RotateCcw className="size-4" aria-hidden /> Perguntar de novo
                  </Botao>
                )}
              </div>

              {pendente ? (
                <Escrevendo comFontes={tentativa === 2} />
              ) : r ? (
                <RespostaIA resposta={r} />
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-p border border-dashed p-4">
                  <Botao variante="secundario" onClick={() => perguntar(p)} disabled={bloqueado || emLote}>
                    {tentativa === 1 ? 'Perguntar à IA' : 'Perguntar com as fontes'}
                  </Botao>
                  <span className="text-sm text-tinta-2">A resposta aparece aqui.</span>
                </div>
              )}

              {erros[p.id] && <Aviso tom="erro">{erros[p.id]}</Aviso>}

              {anterior && r && !pendente && (
                <details className="rounded-p border border-dashed bg-superficie-2/50 px-4 py-3">
                  <summary className="flex items-center gap-1.5 text-sm font-semibold text-tinta-2">
                    <ChevronDown className="seta size-4 -rotate-90" aria-hidden /> Lembrar a resposta sem contexto
                  </summary>
                  <div className="mt-4">
                    <RespostaIA resposta={anterior} compacta />
                  </div>
                </details>
              )}

              {tentativa === 2 && r && !pendente && (
                <div className="space-y-4 border-t pt-4">
                  <Botao
                    variante="secundario"
                    aria-expanded={montagemAberta === p.id}
                    onClick={() => setEscolhaDeMontagem(montagemAberta === p.id ? null : p.id)}
                  >
                    <Workflow className="size-4" aria-hidden />
                    {montagemAberta === p.id ? 'Fechar o esquema' : 'Ver como essa resposta foi montada'}
                  </Botao>
                  {/* key: perguntar de novo troca a resposta, e o esquema recomeça com os dados novos. */}
                  {montagemAberta === p.id && <CaminhoRag key={r.criado_em} estado={estado} pergunta={p} resposta={r} />}
                </div>
              )}
            </Caixa>
          )
        })}
      </ol>

      {tentativa === 1 && completo && (
        <Dica titulo="Antes de seguir, pense" className="mt-8">
          Você confiaria nessas respostas num trabalho da escola? Como faria para conferir?
        </Dica>
      )}

      <Avancar
        para={tentativa === 1 ? 2 : 4}
        rotulo={tentativa === 1 ? 'Adicionar fontes' : 'Comparar e conferir'}
        liberado={completo}
        motivo={`Faltam ${total - respondidas} de ${total}.`}
      />
    </div>
  )
}
