/**
 * Etapa 5: leva o raciocínio da oficina para o estudo com o NotebookLM, um passo por vez. Os três
 * primeiros repetem as etapas 2, 3 e 4, com as fontes e as perguntas desta oficina; o último
 * fecha a oficina com o resumo da pessoa e a opção de apagar os dados.
 */
import { useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, ExternalLink, Trash2 } from 'lucide-react'
import { botaoCls } from '@/components/classes'
import { CabecalhoEtapa, type PropsEtapa } from '@/components/Etapa'
import { Passos } from '@/components/Passos'
import { Aviso, Botao, Caixa } from '@/components/ui'
import { api, textoDoErro, type Estado } from '@/lib/api'
import { ETAPAS_COM_PROGRESSO, progresso } from '@/lib/etapas'
import { href, navegar } from '@/lib/rota'

const PASSOS = ['Monte o caderno', 'Faça as perguntas', 'Confira as citações', 'Para terminar'] as const

/** O mesmo pedido que a plataforma faz à IA na etapa 3, escrito para o aluno colar no NotebookLM. */
function promptPara(pergunta: string) {
  return `Com base só nas fontes deste caderno, responda: ${pergunta} Indique de qual fonte veio cada parte.`
}

/**
 * Copia texto. A API moderna só funciona em contexto seguro (https ou localhost); no laboratório
 * os alunos costumam abrir pelo IP do professor em http, então cai no jeito antigo.
 */
async function copiar(texto: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(texto)
      return true
    }
    const area = document.createElement('textarea')
    area.value = texto
    area.setAttribute('readonly', '')
    area.style.position = 'absolute'
    area.style.left = '-9999px'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

export function NotebookLM({ estado }: PropsEtapa) {
  const [passo, setPasso] = useState(0)
  const topo = useRef<HTMLDivElement>(null)

  function ir(n: number) {
    setPasso(n)
    topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div>
      <CabecalhoEtapa n={5}>
        <p>
          O <strong className="text-tinta">NotebookLM</strong>, do Google, responde usando os documentos que você adiciona e
          mostra de onde tirou cada parte. É o mesmo ciclo que você acabou de fazer: só muda a ferramenta.
        </p>
      </CabecalhoEtapa>

      <div ref={topo} className="scroll-mt-4 space-y-6">
        <Passos titulos={PASSOS} atual={passo} aoEscolher={ir} rotulo="Passos desta etapa" />

        <div key={passo} className="entrar-pagina">
          {passo === 0 && <MonteOCaderno estado={estado} />}
          {passo === 1 && <FacaAsPerguntas estado={estado} />}
          {passo === 2 && <ConfiraAsCitacoes />}
          {passo === 3 && <ParaTerminar estado={estado} />}
        </div>

        <nav aria-label="Navegar nos passos" className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          {passo > 0 ? (
            <Botao variante="discreto" onClick={() => ir(passo - 1)}>
              <ArrowLeft className="size-4" aria-hidden /> {PASSOS[passo - 1]}
            </Botao>
          ) : (
            <span />
          )}
          {passo < PASSOS.length - 1 ? (
            <Botao variante="primario" onClick={() => ir(passo + 1)}>
              {PASSOS[passo + 1]} <ArrowRight className="size-4" aria-hidden />
            </Botao>
          ) : (
            <Concluir estado={estado} />
          )}
        </nav>
      </div>
    </div>
  )
}

/** Fim da oficina: só libera com as etapas 1 a 4 feitas; antes disso, diz quais faltam. */
function Concluir({ estado }: { estado: Estado }) {
  const feito = progresso(estado)
  const faltam = ETAPAS_COM_PROGRESSO.filter((e) => !feito[e])
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {faltam.length > 0 && (
        <p className="text-sm text-tinta-2">
          Para concluir, {faltam.length === 1 ? 'falta a etapa' : 'faltam as etapas'} {faltam.join(', ')}.
        </p>
      )}
      <Botao variante="primario" disabled={faltam.length > 0} onClick={() => navegar('/oficina/concluida')}>
        <CheckCircle2 className="size-4" aria-hidden /> Concluir a oficina
      </Botao>
    </div>
  )
}

/** Um passo: título, o que a pessoa já fez na oficina (uma linha) e o que fazer agora. */
function Painel({ titulo, naOficina, children }: { titulo: string; naOficina: ReactNode; children: ReactNode }) {
  return (
    <Caixa className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{titulo}</h2>
        <p className="text-tinta-2">{naOficina}</p>
      </div>
      {children}
    </Caixa>
  )
}

function MonteOCaderno({ estado }: { estado: Estado }) {
  const nomes = estado.documentos.map((d) => d.nome).join(', ')
  return (
    <Painel
      titulo="Monte o caderno com as suas fontes"
      naOficina={
        nomes ? (
          <>
            Na etapa 2 você escolheu: <strong className="break-words text-tinta">{nomes}</strong>.
          </>
        ) : (
          <>
            Você ainda não adicionou fontes.{' '}
            <a href={href('/oficina/2')} className="font-semibold text-acao underline underline-offset-4">
              Voltar à etapa 2
            </a>
          </>
        )
      }
    >
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>Abra o NotebookLM e entre com uma conta Google.</li>
        <li>Crie um caderno novo.</li>
        <li>Adicione as mesmas fontes (PDF, link ou texto colado).</li>
      </ol>
      <a href="https://notebooklm.google.com/" target="_blank" rel="noopener noreferrer" className={botaoCls('primario')}>
        Abrir o NotebookLM <ExternalLink className="size-4" aria-hidden />
        <span className="sr-only">(abre em outra aba)</span>
      </a>
      <p className="text-sm text-tinta-2">Contas de escola ou de menores de idade podem ter regras próprias: confira antes.</p>
    </Painel>
  )
}

/** As perguntas desta oficina, já escritas como pedido ao NotebookLM, com botão de copiar. */
function FacaAsPerguntas({ estado }: { estado: Estado }) {
  const [copiado, setCopiado] = useState<number | null>(null)
  const [falhou, setFalhou] = useState(false)

  async function aoCopiar(id: number, texto: string) {
    const ok = await copiar(texto)
    setFalhou(!ok)
    setCopiado(ok ? id : null)
  }

  return (
    <Painel titulo="Faça as mesmas perguntas" naOficina="Na etapa 3 a plataforma buscou os trechos para você. Lá, é o NotebookLM que busca. Copie e cole no caderno:">
      <ul className="divide-y border-y">
        {estado.perguntas.map((p) => {
          const texto = promptPara(p.texto)
          return (
            <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-6">
              <span className="min-w-0 flex-1">{texto}</span>
              <button
                type="button"
                onClick={() => aoCopiar(p.id, texto)}
                className={botaoCls('secundario', 'p')}
                aria-label={`Copiar o pedido da pergunta ${p.ordem}`}
              >
                {copiado === p.id ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                <span aria-live="polite">{copiado === p.id ? 'Copiado' : 'Copiar'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {falhou && <p className="text-sm text-erro">Não deu para copiar aqui. Selecione o texto e copie à mão.</p>}
    </Painel>
  )
}

function ConfiraAsCitacoes() {
  return (
    <Painel titulo="Confira cada citação" naOficina="Na etapa 4 você abriu os números amarelos e comparou com a referência. Lá, os números ficam na própria resposta.">
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>Abra cada número de citação da resposta.</li>
        <li>Veja se o trecho diz mesmo aquilo.</li>
        <li>Se uma parte não aponta para nenhuma fonte, trate como palpite.</li>
      </ol>
      <div className="space-y-2 border-t pt-5">
        <h3 className="font-semibold">Cuidados que continuam valendo</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-tinta-2">
          <li>Citação não é garantia: a IA pode resumir errado um trecho certo.</li>
          <li>Fonte ruim gera resposta ruim. Escolha bem o que entra no caderno.</li>
          <li>Não envie documentos com dados pessoais seus ou de outras pessoas.</li>
          <li>Usar outro chatbot para achar materiais pode ajudar, mas confira cada link antes de usar como fonte.</li>
        </ul>
      </div>
    </Painel>
  )
}

/** Fecha a oficina: resumo a partir das avaliações da etapa 4 e a opção de apagar os dados. */
function ParaTerminar({ estado }: { estado: Estado }) {
  const [confirmando, setConfirmando] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [erro, setErro] = useState('')
  const total = estado.avaliacoes.length
  const comFontes = estado.avaliacoes.filter((a) => a.mais_confiavel === 'segunda').length
  const conferiu = estado.avaliacoes.filter((a) => a.conferiu_fonte).length

  /** DELETE /eu: apaga tudo do participante no servidor, esquece o token e volta ao início. */
  async function apagar() {
    setApagando(true)
    try {
      await api.apagarMeusDados()
      navegar('/')
    } catch (e) {
      setErro(textoDoErro(e))
      setApagando(false)
    }
  }

  return (
    <div className="space-y-6">
      <Caixa className="space-y-3 border-acao/40 bg-acao-suave">
        <h2 className="text-xl font-semibold">O que você descobriu, {estado.apelido}</h2>
        {total === 0 ? (
          <p className="text-tinta-2">
            Avalie as respostas na{' '}
            <a href={href('/oficina/4')} className="font-semibold text-acao underline underline-offset-4">
              etapa 4
            </a>{' '}
            e o seu resumo aparece aqui.
          </p>
        ) : (
          <ul className="space-y-1.5 text-tinta-2">
            <li>
              Você confiou mais na resposta <strong className="text-tinta">com fontes</strong> em{' '}
              <strong className="text-tinta">
                {comFontes} de {total}
              </strong>{' '}
              {total === 1 ? 'pergunta' : 'perguntas'}.
            </li>
            <li>
              Abriu a fonte para conferir em{' '}
              <strong className="text-tinta">
                {conferiu} de {total}
              </strong>
              .
            </li>
          </ul>
        )}
        <p className="text-tinta-2">Serve para qualquer matéria: troque as fontes e as perguntas pelas suas.</p>
      </Caixa>

      <Caixa className="space-y-4">
        <h2 className="text-lg font-semibold">Seus dados</h2>
        <p className="max-w-[68ch] text-tinta-2">
          Suas respostas e avaliações ajudam o projeto a entender como as pessoas avaliam a IA. Se preferir, você pode apagar
          tudo agora: apelido, fontes, respostas e avaliações.
        </p>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {confirmando ? (
          <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Confirmar exclusão">
            <p className="font-semibold">Apagar tudo? Isso não pode ser desfeito.</p>
            <Botao variante="perigo" onClick={apagar} carregando={apagando}>
              <Trash2 className="size-4" aria-hidden /> Sim, apagar meus dados
            </Botao>
            <Botao variante="discreto" onClick={() => setConfirmando(false)} disabled={apagando}>
              Cancelar
            </Botao>
          </div>
        ) : (
          <Botao variante="perigo" onClick={() => setConfirmando(true)}>
            <Trash2 className="size-4" aria-hidden /> Apagar meus dados
          </Botao>
        )}
      </Caixa>
    </div>
  )
}
