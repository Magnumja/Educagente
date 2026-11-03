/**
 * Etapa 4, passo 2: a pessoa diz se cada resposta estava correta, em qual confiaria e por quê.
 * Salva com PUT /eu/avaliacoes/{pergunta_id}; se já existe avaliação, o formulário vem preenchido.
 */
import { useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { entradaCls } from '@/components/classes'
import { Aviso, Botao, Caixa, Campo, NumeroDoPasso, Segmentado } from '@/components/ui'
import { api, textoDoErro, type Avaliacao, type Preferencia, type Veredito } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PREFERENCIAS, VEREDITOS } from './opcoes'

export function FormularioDeAvaliacao({
  perguntaId,
  salva,
  recarregar,
  aoSalvar,
}: {
  perguntaId: number
  salva?: Avaliacao
  recarregar: () => Promise<void>
  aoSalvar: () => void
}) {
  const [primeira, setPrimeira] = useState<Veredito | null>(salva?.primeira ?? null)
  const [segunda, setSegunda] = useState<Veredito | null>(salva?.segunda ?? null)
  const [maisConfiavel, setMaisConfiavel] = useState<Preferencia | null>(salva?.mais_confiavel ?? null)
  const [conferiu, setConferiu] = useState(salva?.conferiu_fonte ?? false)
  const [observacao, setObservacao] = useState(salva?.observacao ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const completo = !!(primeira && segunda && maisConfiavel)

  async function salvar() {
    if (!primeira || !segunda || !maisConfiavel) return
    setSalvando(true)
    setErro('')
    try {
      await api.avaliar(perguntaId, { primeira, segunda, mais_confiavel: maisConfiavel, conferiu_fonte: conferiu, observacao })
      await recarregar()
      aoSalvar()
    } catch (e) {
      setErro(textoDoErro(e))
      setSalvando(false)
    }
  }

  return (
    <Caixa className="space-y-6">
      <ol className="space-y-5">
        <ItemNumerado n={1} respondido={!!primeira}>
          <Segmentado legenda="A resposta sem contexto estava…" valor={primeira} opcoes={VEREDITOS} aoMudar={setPrimeira} />
        </ItemNumerado>
        <ItemNumerado n={2} respondido={!!segunda}>
          <Segmentado legenda="A resposta com fontes estava…" valor={segunda} opcoes={VEREDITOS} aoMudar={setSegunda} />
        </ItemNumerado>
        <ItemNumerado n={3} respondido={!!maisConfiavel}>
          <Segmentado legenda="Em qual você confiaria para estudar?" valor={maisConfiavel} opcoes={PREFERENCIAS} aoMudar={setMaisConfiavel} />
        </ItemNumerado>
      </ol>
      <label className="flex items-start gap-3 font-medium">
        <input
          type="checkbox"
          checked={conferiu}
          onChange={(e) => setConferiu(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-[var(--acao)]"
        />
        Abri os trechos citados e conferi se a resposta diz o mesmo que a fonte.
      </label>
      <Campo rotulo="Por quê? (opcional)" dica="Uma frase já ajuda: o que você notou de diferente?">
        {(p) => (
          <textarea
            {...p}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            maxLength={600}
            className={cn(entradaCls, 'resize-y')}
          />
        )}
      </Campo>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div className="flex flex-wrap items-center gap-3">
        <Botao variante="primario" onClick={salvar} disabled={!completo} carregando={salvando}>
          {salva ? 'Atualizar e ver a referência' : 'Salvar e ver a referência'} <ArrowRight className="size-4" aria-hidden />
        </Botao>
        {!completo && <span className="text-sm text-tinta-2">Responda os três itens acima para salvar.</span>}
      </div>
    </Caixa>
  )
}

/** Item da lista com o número à esquerda, que vira um visto verde quando respondido. */
function ItemNumerado({ n, respondido, children }: { n: number; respondido: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <NumeroDoPasso n={respondido ? '✓' : n} tom={respondido ? 'ok' : 'neutro'} />
      <div className="min-w-0 flex-1 pt-1">{children}</div>
    </li>
  )
}
