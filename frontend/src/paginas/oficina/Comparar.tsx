/**
 * Etapa 4: compara, para cada pergunta, a resposta sem contexto (etapa 1) com a resposta com
 * fontes (etapa 3). Aqui ficam os botões "Pergunta 1/2/3" e o fechamento da etapa; o conteúdo
 * de cada pergunta (ler, avaliar, conferir) está em comparar/PaginasDaPergunta.
 */
import { useRef, useState } from 'react'
import { CheckCircle2, MessagesSquare } from 'lucide-react'
import { Avancar, CabecalhoEtapa, type PropsEtapa } from '@/components/Etapa'
import { Aviso, Caixa } from '@/components/ui'
import { respostaDe } from '@/lib/etapas'
import { href } from '@/lib/rota'
import { cn } from '@/lib/utils'
import { PaginasDaPergunta } from './comparar/PaginasDaPergunta'

export function Comparar({ estado, recarregar }: PropsEtapa) {
  const algumaPronta = estado.perguntas.some((p) => respostaDe(estado, p.id, 1) && respostaDe(estado, p.id, 2))
  const avaliadas = new Set(estado.avaliacoes.map((a) => a.pergunta_id))
  // Abre na primeira pergunta ainda não avaliada (ou na primeira, se todas já foram).
  const primeiraPendente = Math.max(
    0,
    estado.perguntas.findIndex((p) => !avaliadas.has(p.id)),
  )
  const [selecionada, setSelecionada] = useState(primeiraPendente)
  const topo = useRef<HTMLDivElement>(null)

  if (!algumaPronta)
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
  const rolarParaOTopo = () => topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const irParaPergunta = (i: number) => {
    setSelecionada(i)
    rolarParaOTopo()
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

      {/* key={pergunta.id}: trocar de pergunta zera o passo e o formulário. */}
      <PaginasDaPergunta
        key={pergunta.id}
        pergunta={pergunta}
        estado={estado}
        recarregar={recarregar}
        avaliada={avaliadas.has(pergunta.id)}
        proxima={selecionada < estado.perguntas.length - 1 ? () => irParaPergunta(selecionada + 1) : undefined}
        aoMudarPagina={rolarParaOTopo}
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
