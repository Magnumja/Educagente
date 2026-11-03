/**
 * Etapa 2: o participante monta a base de fontes que a IA vai consultar na etapa 3.
 * Esta tela só organiza as partes (pasta fontes/) e centraliza executar(): roda a ação na
 * API, recarrega o estado (GET /eu) e mostra a mensagem de sucesso ou de erro.
 */
import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { Avancar, CabecalhoEtapa, type PropsEtapa } from '@/components/Etapa'
import { Aviso, Caixa, Dica, NumeroDoPasso } from '@/components/ui'
import { api, textoDoErro } from '@/lib/api'
import { usePreferencias } from '@/lib/preferencias'
import { AdicionarPropria } from './fontes/AdicionarPropria'
import type { Executar } from './fontes/executar'
import { FontesSugeridas } from './fontes/FontesSugeridas'
import { Orientacao } from './fontes/Orientacao'
import { SuaBase } from './fontes/SuaBase'

export function Fontes({ estado, recarregar }: PropsEtapa) {
  const { prefs } = usePreferencias()
  const [mensagem, setMensagem] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  // Chave da ação em andamento (ver fontes/executar.ts); enquanto houver uma, os outros botões esperam.
  const [ocupado, setOcupado] = useState<string | null>(null)

  const executar: Executar = async (chave, acao, sucesso) => {
    setOcupado(chave)
    setMensagem(null)
    try {
      await acao()
      await recarregar()
      setMensagem({ tom: 'ok', texto: sucesso })
    } catch (e) {
      setMensagem({ tom: 'erro', texto: textoDoErro(e) })
    } finally {
      setOcupado(null)
    }
  }

  const temSugeridas = estado.fontes_sugeridas.length > 0

  return (
    <div>
      <CabecalhoEtapa n={2}>
        <p>
          Dê à IA <strong>materiais confiáveis</strong> para consultar: livro didático, material do professor, site oficial.
        </p>
      </CabecalhoEtapa>

      <div className="space-y-8">
        <SuaBase
          documentos={estado.documentos}
          ocupado={ocupado}
          aoRemover={(d) => executar(`r${d.id}`, () => api.removerDocumento(d.id), `“${d.nome}” saiu da sua base.`)}
        />
        <div className="space-y-8">
          <Caixa className="space-y-6">
            <div className="flex items-start gap-4">
              <NumeroDoPasso n={1} />
              <div>
                <h2 className="text-xl font-semibold">Escolha suas fontes</h2>
                <p className="text-tinta-2">Pode usar uma das sugeridas, enviar um arquivo ou colar um texto.</p>
              </div>
            </div>

            {temSugeridas && (
              <FontesSugeridas sugeridas={estado.fontes_sugeridas} documentos={estado.documentos} ocupado={ocupado} executar={executar} />
            )}

            <AdicionarPropria ocupado={ocupado} executar={executar} temSugeridas={temSugeridas} />

            {mensagem && <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso>}
          </Caixa>

          <Orientacao inicial={estado.orientacao} recarregar={recarregar} />

          <Dica Icone={Lightbulb} titulo="Anexar um documento é o mesmo que RAG?">
            Não exatamente. Anexar e dar instruções é <strong>dar contexto</strong>. Aqui a plataforma vai além: corta suas
            fontes em trechos, procura os mais parecidos com cada pergunta e entrega só esses à IA. Isso é{' '}
            <strong>RAG</strong>.
            {prefs.detalhe === 'tecnico' &&
              ' Cada trecho vira um vetor de números (embedding); a busca compara o vetor da pergunta com os dos trechos pela similaridade de cosseno.'}
          </Dica>
        </div>
      </div>

      <Avancar para={3} rotulo="Perguntar de novo" liberado={estado.documentos.length > 0} motivo="Adicione pelo menos uma fonte." />
    </div>
  )
}
