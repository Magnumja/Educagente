/**
 * Etapa 2: fontes que o facilitador cadastrou na oficina. "Usar esta fonte" faz uma cópia
 * dela na base do participante (POST /eu/fontes-sugeridas/{id}).
 */
import { Check, FileText, Plus } from 'lucide-react'
import { Botao } from '@/components/ui'
import { api, type Documento } from '@/lib/api'
import { atraso, cn, plural } from '@/lib/utils'
import type { Executar } from './executar'

export function FontesSugeridas({
  sugeridas,
  documentos,
  ocupado,
  executar,
}: {
  sugeridas: Documento[]
  documentos: Documento[]
  ocupado: string | null
  executar: Executar
}) {
  // A cópia guarda de qual sugerida veio (copia_de_id): assim sabemos quais já estão na base.
  const naBase = new Set(documentos.map((d) => d.copia_de_id).filter((id): id is number => id !== null))

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-tinta-2">Sugeridas pelo facilitador</h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {sugeridas.map((f, i) => {
          const adicionada = naBase.has(f.id)
          return (
            <li
              key={f.id}
              style={atraso(i)}
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
  )
}
