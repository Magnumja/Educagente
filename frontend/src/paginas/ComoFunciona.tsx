/**
 * Página #/como-funciona: explica, sem jargão, a diferença entre dar contexto e RAG, o caminho
 * de uma pergunta e os limites. Tem uma simulação de busca que roda só no navegador.
 */
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { entradaCls } from '@/components/classes'
import { Caixa, Campo } from '@/components/ui'
import { atraso, cn, porcentagem } from '@/lib/utils'

const ETAPAS_RAG = [
  { titulo: 'Cortar em trechos', texto: 'O texto das fontes é dividido em pedaços de alguns parágrafos.' },
  { titulo: 'Transformar em números', texto: 'Cada trecho vira uma lista de números que representa o assunto dele.' },
  { titulo: 'Buscar os mais parecidos', texto: 'A pergunta também vira números, e a plataforma acha os trechos mais próximos.' },
  { titulo: 'Responder citando', texto: 'A IA recebe a pergunta junto com esses trechos e responde indicando de onde veio cada parte.' },
]

const FONTE_EXEMPLO = [
  'O ciclo da água é o movimento contínuo da água entre a superfície da Terra e a atmosfera.',
  'Com o calor do Sol, a água de rios, lagos e oceanos evapora e sobe como vapor.',
  'Ao subir, o vapor esfria e se condensa em gotículas, formando as nuvens.',
  'Quando as gotículas ficam pesadas, a água volta à superfície como chuva, granizo ou neve: é a precipitação.',
  'Parte da água da chuva infiltra no solo e abastece os lençóis freáticos.',
]

/** Palavras muito comuns que não dizem nada sobre o assunto, ignoradas na simulação. */
const PARADAS = new Set('que qual quais quem como onde quando para por com uma umas uns dos das nos nas pelo pela isso esse essa sao ser tem por que'.split(' '))

/** Palavras de um texto sem acento, sem as PARADAS e cortadas em 5 letras ("nuvens" e "nuvem" batem). */
function palavras(texto: string) {
  return new Set(
    texto
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length > 2 && !PARADAS.has(p))
      .map((p) => p.slice(0, 5)),
  )
}

export function ComoFunciona() {
  return (
    <div className="space-y-16">
      <header className="max-w-[68ch] space-y-4">
        <h1 className="text-[2.1rem] font-bold tracking-tight sm:text-5xl">Como a IA usa fontes</h1>
        <p className="text-lg text-tinta-2">
          Um modelo de linguagem escreve o texto que <strong className="text-tinta">parece mais provável</strong> a partir do
          que aprendeu no treino. Por isso pode inventar detalhes com toda a segurança. Dar fontes muda o que ele tem em mãos na
          hora de responder.
        </p>
      </header>

      <section aria-labelledby="contexto-rag" className="space-y-6">
        <h2 id="contexto-rag" className="text-2xl font-bold">
          Dar contexto não é o mesmo que RAG
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 border-t-2 border-tinta pt-4">
            <h3 className="text-lg font-semibold">Dar contexto</h3>
            <p className="text-tinta-2">
              Você anexa um documento ou escreve instruções na conversa. A IA recebe tudo de uma vez, do jeito que você mandou.
              Com textos grandes, partes importantes podem se perder.
            </p>
          </div>
          <div className="space-y-2 border-t-2 border-acao pt-4">
            <h3 className="text-lg font-semibold">RAG: geração aumentada por recuperação</h3>
            <p className="text-tinta-2">
              Um sistema guarda as fontes, <strong className="text-tinta">recupera</strong> só os trechos que têm a ver com a
              pergunta e entrega esses trechos à IA. Cada resposta pode apontar o documento e a página de onde veio.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="caminho" className="space-y-6">
        <h2 id="caminho" className="text-2xl font-bold">
          O caminho de uma pergunta com RAG
        </h2>
        <ol className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {/* Cada etapa vem seguida de uma seta; o --i conta as duas para entrarem em sequência. */}
          {ETAPAS_RAG.map((e, i) => [
            <li key={e.titulo} style={atraso(i * 2)} className="surgir levanta rounded-caixa border bg-superficie p-5 shadow-caixa">
              <p className="font-mono text-sm font-bold text-acao">{i + 1}</p>
              <h3 className="mt-1 font-semibold">{e.titulo}</h3>
              <p className="mt-1 text-[0.95rem] text-tinta-2">{e.texto}</p>
            </li>,
            i < ETAPAS_RAG.length - 1 && (
              <li key={`seta-${i}`} aria-hidden style={atraso(i * 2 + 1)} className="surgir grid place-items-center text-acao">
                <ArrowRight className="hidden size-5 lg:block" />
                <ArrowDown className="size-5 lg:hidden" />
              </li>
            ),
          ])}
        </ol>
      </section>

      <Experimente />

      <section aria-labelledby="limites" className="max-w-[70ch] space-y-4">
        <h2 id="limites" className="text-2xl font-bold">
          O que o RAG não resolve
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-tinta-2">
          <li>
            <strong className="text-tinta">Fonte errada, resposta errada.</strong> A IA confia no que recebe. Quem escolhe as
            fontes continua responsável por elas.
          </li>
          <li>
            <strong className="text-tinta">A IA pode resumir mal.</strong> Mesmo com o trecho certo, ela pode distorcer.
            Por isso, abra a citação.
          </li>
          <li>
            <strong className="text-tinta">A busca pode errar o trecho.</strong> Se a pergunta usa palavras muito diferentes
            das fontes, o trecho certo pode ficar de fora.
          </li>
          <li>
            <strong className="text-tinta">“Não encontrei” é uma boa resposta.</strong> Melhor admitir do que inventar.
          </li>
        </ul>
      </section>
    </div>
  )
}

/** Nota mínima para um trecho entrar na simulação. */
const LIMIAR = 0.2

/**
 * Simulação da busca do RAG feita no próprio navegador: a nota de cada trecho é a fração das
 * palavras da pergunta que aparecem nele. Entram os 2 melhores acima do limiar.
 */
function Experimente() {
  const [pergunta, setPergunta] = useState('Como as nuvens se formam?')

  const ranking = useMemo(() => {
    const q = palavras(pergunta)
    return FONTE_EXEMPLO.map((texto, i) => {
      const t = palavras(texto)
      const comuns = [...q].filter((p) => t.has(p)).length
      return { i, texto, nota: q.size ? comuns / q.size : 0 }
    })
  }, [pergunta])
  const escolhidos = [...ranking]
    .filter((r) => r.nota >= LIMIAR && r.nota > 0)
    .sort((a, b) => b.nota - a.nota)
    .slice(0, 2)
    .map((r) => r.i)

  return (
    <section aria-labelledby="experimente">
      <Caixa className="space-y-6">
        <div className="max-w-[68ch] space-y-2">
          <h2 id="experimente" className="text-2xl font-bold">
            Experimente a busca
          </h2>
          <p className="text-tinta-2">
            Abaixo há uma fonte curta sobre o ciclo da água, já cortada em trechos. Escreva uma pergunta e veja quais trechos
            seriam entregues à IA.
          </p>
          <p className="text-sm text-tinta-2">
            Simulação simplificada: aqui comparamos palavras em comum. A plataforma de verdade compara o significado, então acha
            trechos mesmo com palavras diferentes.
          </p>
        </div>

        <Campo rotulo="Sua pergunta">
          {(p) => <input {...p} value={pergunta} onChange={(e) => setPergunta(e.target.value)} className={entradaCls} />}
        </Campo>


        <ol className="space-y-2" aria-live="polite">
          {ranking.map((r) => {
            const entra = escolhidos.includes(r.i)
            return (
              <li
                key={r.i}
                className={cn(
                  'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-p border p-3 transition-[background-color,border-color,opacity] duration-300',
                  entra ? 'border-evidencia-tinta/50 bg-superficie shadow-caixa' : 'bg-superficie-2 opacity-80',
                )}
              >
                <span className="font-mono text-sm font-bold text-tinta-2">Trecho {r.i + 1}</span>
                <span className={cn('min-w-0 flex-1 basis-64', !entra && 'text-tinta-2')}>
                  {entra ? <span className="marca-texto">{r.texto}</span> : r.texto}
                </span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2 w-20 overflow-hidden rounded-full bg-linha" aria-hidden>
                    <span className="block h-full bg-acao transition-[width] duration-500" style={{ width: porcentagem(r.nota) }} />
                  </span>
                  {entra ? 'Vai para a IA' : 'Fica de fora'}
                </span>
              </li>
            )
          })}
        </ol>
        {escolhidos.length === 0 && (
          <p className="font-semibold">Nenhum trecho passou. Com RAG, a resposta certa aqui é: “as fontes não falam disso”.</p>
        )}
      </Caixa>
    </section>
  )
}
