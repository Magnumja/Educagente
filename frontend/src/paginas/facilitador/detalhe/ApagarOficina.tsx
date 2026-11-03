/** Rodapé da tela da oficina: apagar a oficina inteira (DELETE /facilitador/oficinas/{id}), com confirmação. */
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Botao } from '@/components/ui'
import { api } from '@/lib/api'
import { navegar } from '@/lib/rota'
import { plural } from '@/lib/utils'
import type { PropsDaParte } from './tipos'

export function ApagarOficina({ oficina, executar }: PropsDaParte) {
  const [confirmando, setConfirmando] = useState(false)

  const apagar = () =>
    executar(async () => {
      await api.facilitador.apagar(oficina.id)
      navegar('/facilitador')
    })

  return (
    <div className="border-t pt-6">
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">
            Apagar a oficina e os dados de {plural(oficina.total_participantes, 'participante')}? Não dá para desfazer.
          </span>
          <Botao variante="perigo" onClick={apagar}>
            Sim, apagar a oficina
          </Botao>
          <Botao variante="discreto" onClick={() => setConfirmando(false)}>
            Cancelar
          </Botao>
        </div>
      ) : (
        <Botao variante="discreto" onClick={() => setConfirmando(true)}>
          <Trash2 className="size-4" aria-hidden /> Apagar esta oficina
        </Botao>
      )}
    </div>
  )
}
