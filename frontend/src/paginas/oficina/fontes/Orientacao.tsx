/**
 * Etapa 2, passo 2 (opcional): a orientação de estilo que vai junto com os trechos na
 * etapa 3 ("responda em até três frases"). Salva com PUT /eu/orientacao.
 */
import { useState } from 'react'
import { Check } from 'lucide-react'
import { entradaCls } from '@/components/classes'
import { Botao, Caixa, Campo } from '@/components/ui'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const SUGESTOES_DE_ORIENTACAO = [
  'Explique como para alguém de 15 anos.',
  'Responda em até três frases.',
  'Se as fontes não tiverem a resposta, diga isso.',
  'Termine com uma pergunta para eu pensar.',
]

const LIMITE = 800

type Situacao = 'parado' | 'salvando' | 'salvo' | 'erro'

export function Orientacao({ inicial, recarregar }: { inicial: string; recarregar: () => Promise<void> }) {
  const [texto, setTexto] = useState(inicial)
  const [situacao, setSituacao] = useState<Situacao>('parado')
  const mudou = texto.trim() !== inicial.trim()

  async function salvar() {
    setSituacao('salvando')
    try {
      await api.salvarOrientacao(texto)
      await recarregar()
      setSituacao('salvo')
    } catch {
      setSituacao('erro')
    }
  }

  /** Clicar numa sugestão acrescenta a frase ao fim do texto, respeitando o limite. */
  function acrescentar(sugestao: string) {
    setTexto((t) => (t.trim() ? `${t.trim()} ${sugestao}` : sugestao).slice(0, LIMITE))
    setSituacao('parado')
  }

  return (
    <Caixa className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">
          Diga como quer a resposta <span className="text-base font-normal text-tinta-2">(opcional)</span>
        </h2>
        <p className="text-tinta-2">Essa orientação vai junto com os trechos na etapa 3.</p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Sugestões de orientação">
        {SUGESTOES_DE_ORIENTACAO.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => acrescentar(s)}
            className="rounded-full border border-linha-forte bg-superficie px-3 py-1.5 text-sm transition-[background-color,border-color,transform] duration-200 hover:border-acao hover:bg-acao-suave active:scale-95"
          >
            + {s}
          </button>
        ))}
      </div>
      <Campo rotulo="Sua orientação" dica={`${texto.length} de ${LIMITE} caracteres. Ela muda o jeito de responder, não os fatos.`}>
        {(p) => (
          <textarea
            {...p}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setSituacao('parado')
            }}
            rows={3}
            maxLength={LIMITE}
            placeholder="Ex.: Explique com um exemplo do dia a dia."
            className={cn(entradaCls, 'resize-y')}
          />
        )}
      </Campo>
      <div className="flex flex-wrap items-center gap-3">
        <Botao variante="secundario" onClick={salvar} disabled={!mudou} carregando={situacao === 'salvando'}>
          Salvar orientação
        </Botao>
        <span role="status" className="text-sm text-tinta-2">
          {situacao === 'salvo' && !mudou && (
            <span className="inline-flex items-center gap-1 font-semibold text-ok">
              <Check className="estalo size-4" aria-hidden /> Salva.
            </span>
          )}
          {situacao === 'erro' && <span className="text-erro">Não deu para salvar. Tente de novo.</span>}
          {mudou && situacao === 'parado' && 'Alterações ainda não salvas.'}
        </span>
      </div>
    </Caixa>
  )
}
