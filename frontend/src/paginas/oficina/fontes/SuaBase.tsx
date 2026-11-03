/**
 * Etapa 2: cartão "Sua base de fontes", com os documentos que a IA vai consultar na etapa 3
 * e o botão de remover cada um.
 */
import { Library, Trash2 } from 'lucide-react'
import { Botao, Caixa } from '@/components/ui'
import type { Documento } from '@/lib/api'
import { atraso, plural } from '@/lib/utils'

const ORIGEM: Record<Documento['origem'], string> = {
  enviado: 'arquivo enviado',
  colado: 'texto colado',
  sugerido: 'sugerida pelo facilitador',
}

export function SuaBase({ documentos, ocupado, aoRemover }: { documentos: Documento[]; ocupado: string | null; aoRemover: (d: Documento) => void }) {
  return (
    <aside aria-labelledby="base">
      <Caixa as="div" className="space-y-4 border-evidencia-tinta/30">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-evidencia text-tinta" aria-hidden>
            <Library className="size-5" />
          </span>
          <div>
            <h2 id="base" className="font-semibold">
              Sua base de fontes
            </h2>
            <p className="text-sm text-tinta-2">{documentos.length === 0 ? 'Vazia por enquanto' : plural(documentos.length, 'fonte')}</p>
          </div>
        </div>
        {documentos.length === 0 ? (
          <p className="rounded-p border border-dashed p-4 text-sm text-tinta-2">
            A IA só vai consultar o que estiver aqui. Adicione pelo menos uma fonte.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {documentos.map((d, i) => (
              <li key={d.id} style={atraso(i)} className="surgir flex items-center gap-2 rounded-p border bg-superficie-2/50 p-3">
                <div className="mr-auto min-w-0">
                  <p className="truncate text-sm font-semibold">{d.nome}</p>
                  <p className="text-xs text-tinta-2">
                    {ORIGEM[d.origem]} · {plural(d.trechos, 'trecho')}
                  </p>
                </div>
                <Botao
                  tamanho="p"
                  variante="discreto"
                  aria-label={`Remover ${d.nome}`}
                  title="Remover"
                  carregando={ocupado === `r${d.id}`}
                  disabled={!!ocupado}
                  onClick={() => aoRemover(d)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Caixa>
    </aside>
  )
}
