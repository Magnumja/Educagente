/** Etapa 4, passo 3: lembra o que a pessoa respondeu, para comparar com a referência. */
import type { Avaliacao, Preferencia, Veredito } from '@/lib/api'
import { PREFERENCIAS, VEREDITOS } from './opcoes'

const ROTULO_VEREDITO = Object.fromEntries(VEREDITOS.map((v) => [v.valor, v.rotulo.toLowerCase()])) as Record<Veredito, string>
const ROTULO_PREFERENCIA = Object.fromEntries(PREFERENCIAS.map((p) => [p.valor, p.rotulo.toLowerCase()])) as Record<Preferencia, string>

export function ResumoDaAvaliacao({ avaliacao }: { avaliacao: Avaliacao }) {
  return (
    <div className="rounded-caixa border bg-superficie-2/60 p-4">
      <p className="mb-2 text-sm font-semibold text-tinta-2">Você disse que:</p>
      <ul className="space-y-1">
        <li>
          a sem contexto estava <strong>{ROTULO_VEREDITO[avaliacao.primeira]}</strong>;
        </li>
        <li>
          a com fontes estava <strong>{ROTULO_VEREDITO[avaliacao.segunda]}</strong>;
        </li>
        <li>
          confiaria mais em <strong>{ROTULO_PREFERENCIA[avaliacao.mais_confiavel]}</strong>.
        </li>
      </ul>
    </div>
  )
}
