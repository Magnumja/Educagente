/**
 * Página #/facilitador/oficina/{id}: a oficina vista pelo facilitador. Carrega os dados
 * (GET /facilitador/oficinas/{id}), atualiza sozinha a cada 20 s e organiza as partes da
 * pasta detalhe/: cabeçalho com o código, três abas (turma, conteúdo, roteiro) e apagar.
 * Todas as ações passam por executar(), que chama a API e recarrega a oficina em seguida.
 */
import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { Aviso, Botao, Carregando, Segmentado } from '@/components/ui'
import { api, sessaoExpirou, textoDoErro, type OficinaDetalhe } from '@/lib/api'
import { ApagarOficina } from './detalhe/ApagarOficina'
import { CabecalhoDaOficina } from './detalhe/CabecalhoDaOficina'
import { Conteudo } from './detalhe/Conteudo'
import { Roteiro } from './detalhe/Roteiro'
import type { Executar } from './detalhe/tipos'
import { Turma } from './detalhe/Turma'

type Aba = 'turma' | 'conteudo' | 'roteiro'

const INTERVALO_DE_ATUALIZACAO = 20_000

export function DetalheDaOficina({ id, aoSessaoExpirar }: { id: number; aoSessaoExpirar: () => void }) {
  const [oficina, setOficina] = useState<OficinaDetalhe | null>(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<Aba>('turma')
  const [atualizando, setAtualizando] = useState(false)

  /** Trata um erro de qualquer chamada: 401 encerra a sessão; o resto vira aviso na tela. */
  const tratarErro = useCallback(
    (e: unknown) => {
      if (sessaoExpirou(e)) aoSessaoExpirar()
      else setErro(textoDoErro(e))
    },
    [aoSessaoExpirar],
  )

  const buscar = useCallback(async () => {
    try {
      setOficina(await api.facilitador.oficina(id))
      setErro('')
    } catch (e) {
      tratarErro(e)
    }
  }, [id, tratarErro])

  /** buscar() com o giro no botão "Atualizar" (clique, atualização automática e depois de cada ação). */
  const atualizar = useCallback(async () => {
    setAtualizando(true)
    await buscar()
    setAtualizando(false)
  }, [buscar])

  useEffect(() => {
    // Os setState de buscar() só rodam depois do await, quando o servidor responde.
    // oxlint-disable-next-line react/set-state-in-effect
    void buscar()
    // Atualiza sozinho enquanto a turma responde (só com a aba do navegador visível).
    const t = window.setInterval(() => document.visibilityState === 'visible' && atualizar(), INTERVALO_DE_ATUALIZACAO)
    return () => window.clearInterval(t)
  }, [buscar, atualizar])

  if (!oficina) return erro ? <Aviso tom="erro">{erro}</Aviso> : <Carregando />

  const executar: Executar = async (acao) => {
    setErro('')
    try {
      await acao()
      await atualizar()
    } catch (e) {
      tratarErro(e)
    }
  }
  const props = { oficina, executar }

  return (
    <div className="space-y-8">
      <CabecalhoDaOficina {...props} />
      {erro && <Aviso tom="erro">{erro}</Aviso>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <Segmentado<Aba>
          legenda="Mostrar"
          compacto
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: 'turma', rotulo: `Respostas da turma (${oficina.total_participantes})` },
            { valor: 'conteudo', rotulo: 'Perguntas e fontes' },
            { valor: 'roteiro', rotulo: 'Roteiro da apresentação' },
          ]}
        />
        {aba === 'turma' && (
          <div className="flex flex-wrap gap-2">
            <Botao tamanho="p" variante="discreto" onClick={atualizar} carregando={atualizando}>
              <RefreshCw className="size-4" aria-hidden /> Atualizar
            </Botao>
            <Botao tamanho="p" variante="secundario" onClick={() => executar(() => api.facilitador.baixarCsv(oficina.id, oficina.codigo))}>
              <Download className="size-4" aria-hidden /> Exportar CSV
            </Botao>
          </div>
        )}
      </div>

      {aba === 'turma' && <Turma {...props} />}
      {aba === 'conteudo' && <Conteudo {...props} />}
      {aba === 'roteiro' && <Roteiro />}

      <ApagarOficina {...props} />
    </div>
  )
}
