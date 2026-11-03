/**
 * Página #/oficina/N do participante. Carrega o estado dele (GET /eu), mostra a Trilha à
 * esquerda e a etapa N à direita. É a dona do estado: as etapas recebem estado + recarregar
 * e, depois de cada ação (perguntar, adicionar fonte, avaliar), chamam recarregar() para
 * buscar o estado novo. Sem número na rota, abre na primeira etapa ainda não feita.
 */
import { useCallback, useEffect, useState } from 'react'
import { botaoCls } from '@/components/classes'
import { Trilha } from '@/components/Trilha'
import { Aviso, Carregando } from '@/components/ui'
import { api, ErroApi, sessao, textoDoErro, type Estado } from '@/lib/api'
import { ETAPAS, etapaAtual } from '@/lib/etapas'
import { href } from '@/lib/rota'
import { Comparar } from './oficina/Comparar'
import { Fontes } from './oficina/Fontes'
import { NotebookLM } from './oficina/NotebookLM'
import { Perguntas } from './oficina/Perguntas'

/** Sem token salvo nem adianta chamar a API: já começa como "sessão inexistente" (401). */
const erroInicial = () => (sessao.participante() ? null : new ErroApi(401, ''))

export function Oficina({ etapa }: { etapa: number | null }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erro, setErro] = useState<ErroApi | null>(erroInicial)

  const recarregar = useCallback(async () => {
    try {
      setEstado(await api.estado())
      setErro(null)
    } catch (e) {
      const falha = e instanceof ErroApi ? e : new ErroApi(0, textoDoErro(e))
      // Token recusado: apaga do navegador para o Início oferecer entrar de novo.
      if (falha.status === 401) sessao.definirParticipante(null)
      setErro(falha)
    }
  }, [])

  // Busca o estado ao abrir a página. O lint acha que há setState síncrono aqui, mas os
  // setState de recarregar() só rodam depois do await, quando a resposta do servidor chega.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (sessao.participante()) void recarregar()
  }, [recarregar])

  if (erro?.status === 401)
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Aviso tom="info" titulo="Você ainda não entrou numa oficina">
          Digite o código mostrado pelo facilitador para começar.
        </Aviso>
        <a href={href('/')} className={botaoCls('primario')}>
          Ir para o início
        </a>
      </div>
    )
  // Com o estado já carregado, um erro numa recarga não troca a tela: a etapa continua visível.
  if (erro && !estado)
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Aviso tom="erro" titulo="Não deu para carregar a oficina">
          {erro.message}
        </Aviso>
        <button type="button" onClick={recarregar} className={botaoCls('secundario')}>
          Tentar de novo
        </button>
      </div>
    )
  if (!estado) return <Carregando />

  const n = etapa && etapa >= 1 && etapa <= ETAPAS.length ? etapa : etapaAtual(estado)
  const props = { estado, recarregar }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
      <Trilha estado={estado} atual={n} />
      {/* key={n}: trocar de etapa remonta o bloco, e a animação .entrar-pagina roda de novo. */}
      <div key={n} className="entrar-pagina min-w-0">
        {n === 1 && <Perguntas {...props} tentativa={1} />}
        {n === 2 && <Fontes {...props} />}
        {n === 3 && <Perguntas {...props} tentativa={2} />}
        {n === 4 && <Comparar {...props} />}
        {n === 5 && <NotebookLM {...props} />}
      </div>
    </div>
  )
}
