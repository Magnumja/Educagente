/**
 * Aba "Respostas da turma": tabela de resumo por pergunta e, abaixo, cada participante com
 * as duas respostas, a avaliação e a opção de apagar os dados dele. Os dados vêm de
 * oficina.relatorio (GET /facilitador/oficinas/{id}).
 */
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { RespostaIA } from '@/components/RespostaIA'
import { Botao, Caixa } from '@/components/ui'
import { api, type Avaliacao, type LinhaRelatorio, type OficinaDetalhe, type Preferencia, type Veredito } from '@/lib/api'
import { cn, plural } from '@/lib/utils'
import type { PropsDaParte } from './tipos'

// Rótulos em terceira pessoa, para o facilitador ler ("avaliou como em parte").
const VEREDITO: Record<Veredito, string> = { correta: 'correta', parcial: 'em parte', errada: 'errada', nao_sei: 'não sabe' }
const PREFERENCIA: Record<Preferencia, string> = { primeira: 'sem contexto', segunda: 'com fontes', nenhuma: 'nenhuma' }

export function Turma({ oficina, executar }: PropsDaParte) {
  if (oficina.relatorio.length === 0)
    return (
      <Caixa className="space-y-2">
        <p className="font-semibold">Ninguém entrou ainda.</p>
        <p className="text-tinta-2">Mostre o código no projetor. As respostas aparecem aqui e a tela se atualiza sozinha.</p>
      </Caixa>
    )

  return (
    <div className="space-y-8">
      <ResumoPorPergunta oficina={oficina} />
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

/** Uma linha por pergunta, somando o que a turma fez. linha.perguntas[i] segue a ordem de oficina.perguntas. */
function ResumoPorPergunta({ oficina }: { oficina: OficinaDetalhe }) {
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
              const avaliacoes = itens.map((x) => x?.avaliacao).filter((a): a is Avaliacao => !!a)
              const conta = (p: Preferencia) => avaliacoes.filter((a) => a.mais_confiavel === p).length
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

/** Participante num <details>: fechado mostra só os números; aberto mostra tudo o que ele fez. */
function Participante({ linha, oficina, executar }: PropsDaParte & { linha: LinhaRelatorio }) {
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
