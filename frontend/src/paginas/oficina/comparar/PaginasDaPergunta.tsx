/**
 * Etapa 4, uma pergunta por vez, em três passos curtos: 1) ler as duas respostas lado a lado,
 * 2) avaliar, 3) ver a resposta de referência do facilitador. O passo 3 só abre depois
 * de avaliar, para a pessoa pensar sozinha antes de ver a "resposta certa".
 */
import { useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, BookMarked, ClipboardCheck, MessageSquareDashed, Scale } from 'lucide-react'
import type { PropsEtapa } from '@/components/Etapa'
import { RespostaIA } from '@/components/RespostaIA'
import { Aviso, Botao, Caixa, Dica } from '@/components/ui'
import type { Pergunta } from '@/lib/api'
import { respostaDe } from '@/lib/etapas'
import { atraso, cn } from '@/lib/utils'
import { FormularioDeAvaliacao } from './FormularioDeAvaliacao'
import { ResumoDaAvaliacao } from './ResumoDaAvaliacao'

const PASSOS = ['Leia as respostas', 'Diga o que concluiu', 'Confira a referência'] as const

interface Props extends PropsEtapa {
  pergunta: Pergunta
  avaliada: boolean
  /** Vai para a próxima pergunta; ausente na última. */
  proxima?: () => void
  /** Avisa a tela de cima para rolar até o topo ao trocar de passo. */
  aoMudarPagina: () => void
}

export function PaginasDaPergunta({ pergunta, estado, recarregar, avaliada, proxima, aoMudarPagina }: Props) {
  // Quem já avaliou volta direto para a referência.
  const [pagina, setPagina] = useState(avaliada ? 2 : 0)
  const primeira = respostaDe(estado, pergunta.id, 1)
  const segunda = respostaDe(estado, pergunta.id, 2)
  const salva = estado.avaliacoes.find((a) => a.pergunta_id === pergunta.id)
  const referencia = estado.referencias[String(pergunta.id)]

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
        {PASSOS.map((titulo, i) => (
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

      {/* key={pagina}: cada passo entra com a animação .entrar-pagina. */}
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
              style={atraso(1)}
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
              <Dica Icone={AlertTriangle} titulo="Fonte não é garantia" style={atraso(1)}>
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
            <ArrowLeft className="size-4" aria-hidden /> {PASSOS[pagina - 1]}
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
