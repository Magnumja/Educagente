/**
 * Área do facilitador (#/facilitador...). Sem token, mostra o login; com token, um mini
 * roteador: lista de oficinas, nova oficina (#/facilitador/nova) ou o detalhe de uma
 * (#/facilitador/oficina/{id}, em DetalheDaOficina.tsx).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { LogOut, Plus } from 'lucide-react'
import { botaoCls, entradaCls } from '@/components/classes'
import { Aviso, Botao, Caixa, Campo, Carregando } from '@/components/ui'
import { api, sessao, sessaoExpirou, textoDoErro, type OficinaFacilitador } from '@/lib/api'
import { href, navegar } from '@/lib/rota'
import { cn, plural } from '@/lib/utils'
import { DetalheDaOficina } from './DetalheDaOficina'

/** partes = o resto da rota depois de #/facilitador: [], ['nova'] ou ['oficina', id]. */
export function Facilitador({ partes }: { partes: string[] }) {
  const [logado, setLogado] = useState(!!sessao.facilitador())
  // Usado no botão Sair e quando o servidor responde 401 (sessão expirou): as telas recebem como aoSessaoExpirar.
  const sair = useCallback(() => {
    api.facilitador.sair()
    setLogado(false)
    navegar('/facilitador')
  }, [])
  if (!logado) return <Login aoEntrar={() => setLogado(true)} />

  const [secao, id] = partes
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <nav aria-label="Facilitador" className="flex flex-wrap items-center gap-2 text-sm">
          <a href={href('/facilitador')} className="font-semibold text-acao underline-offset-4 hover:underline">
            Minhas oficinas
          </a>
          {secao === 'nova' && <span className="text-tinta-2">/ Nova oficina</span>}
        </nav>
        <Botao tamanho="p" variante="discreto" onClick={sair}>
          <LogOut className="size-4" aria-hidden /> Sair
        </Botao>
      </div>
      {secao === 'nova' ? (
        <NovaOficina aoSessaoExpirar={sair} />
      ) : secao === 'oficina' && id ? (
        <DetalheDaOficina id={Number(id)} aoSessaoExpirar={sair} />
      ) : (
        <ListaDeOficinas aoSessaoExpirar={sair} />
      )}
    </div>
  )
}

/** POST /facilitador/entrar com a senha; o token de sessão volta e fica no sessionStorage. */
function Login({ aoEntrar }: { aoEntrar: () => void }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    try {
      await api.facilitador.entrar(senha)
      aoEntrar()
    } catch (err) {
      setErro(textoDoErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Área do facilitador</h1>
      <p className="text-tinta-2">Crie oficinas, acompanhe as respostas da turma e exporte os dados da pesquisa.</p>
      <Caixa>
        <form onSubmit={enviar} className="space-y-5">
          <Campo rotulo="Senha do facilitador" dica="Definida no arquivo .env do servidor (FACILITADOR_SENHA).">
            {(p) => (
              <input
                {...p}
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                required
                className={entradaCls}
              />
            )}
          </Campo>
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <Botao type="submit" variante="primario" carregando={enviando} disabled={!senha} className="w-full">
            Entrar
          </Botao>
        </form>
      </Caixa>
      <p className="text-sm text-tinta-2">Num computador compartilhado, clique em “Sair” ao terminar. A sessão também acaba ao fechar a aba.</p>
    </div>
  )
}

/** GET /facilitador/oficinas: lista com código, título, participantes e se está aberta. */
function ListaDeOficinas({ aoSessaoExpirar }: { aoSessaoExpirar: () => void }) {
  const [oficinas, setOficinas] = useState<OficinaFacilitador[] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    api.facilitador
      .oficinas()
      .then(setOficinas)
      .catch((e: unknown) => (sessaoExpirou(e) ? aoSessaoExpirar() : setErro(textoDoErro(e))))
  }, [aoSessaoExpirar])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Minhas oficinas</h1>
        <a href={href('/facilitador/nova')} className={botaoCls('primario')}>
          <Plus className="size-4" aria-hidden /> Nova oficina
        </a>
      </div>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {!oficinas && !erro && <Carregando />}
      {oficinas?.length === 0 && (
        <Caixa className="space-y-2">
          <p className="font-semibold">Nenhuma oficina ainda.</p>
          <p className="text-tinta-2">
            Crie uma com as três perguntas que a turma vai fazer. Dica: há um exemplo pronto sobre Napoleão no formulário, e o
            comando <code className="font-mono text-sm">python manage.py criar_oficina_exemplo</code> cria um com fonte.
          </p>
        </Caixa>
      )}
      {oficinas && oficinas.length > 0 && (
        <ul className="divide-y rounded-caixa border bg-superficie">
          {oficinas.map((o) => (
            <li key={o.id}>
              <a href={href(`/facilitador/oficina/${o.id}`)} className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4 hover:bg-superficie-2">
                <span className="font-mono text-lg font-bold tracking-widest">{o.codigo}</span>
                <span className="mr-auto min-w-0 font-semibold">{o.titulo}</span>
                <span className="text-sm text-tinta-2">{plural(o.total_participantes, 'participante')}</span>
                <span className={cn('text-sm font-semibold', o.aberta ? 'text-ok' : 'text-tinta-2')}>
                  {o.aberta ? 'Aberta' : 'Fechada'}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Oficina de exemplo do botão "Preencher com o exemplo": perguntas em que a IA costuma errar. */
const EXEMPLO = {
  titulo: 'Napoleão e o Brasil',
  perguntas: [
    {
      texto: 'Napoleão Bonaparte chegou a visitar o Brasil?',
      referencia: 'Não. Napoleão nunca esteve no Brasil; a ligação é indireta, pela invasão francesa a Portugal em 1807.',
    },
    {
      texto: 'Por que a família real portuguesa veio para o Brasil em 1808?',
      referencia:
        'Porque tropas de Napoleão, comandadas por Junot, invadiram Portugal em novembro de 1807. A corte fugiu escoltada pelos ingleses e chegou a Salvador em janeiro e ao Rio em março de 1808.',
    },
    {
      texto: 'Napoleão Bonaparte era muito baixo para a época dele?',
      referencia:
        'Não. Media cerca de 1,69 m, altura comum na França da época; o mito vem da confusão entre polegadas francesas e inglesas e das caricaturas inglesas.',
    },
  ],
}

const VAZIA = { titulo: '', perguntas: [0, 1, 2].map(() => ({ texto: '', referencia: '' })) }

/** Formulário de nova oficina: título + três perguntas (POST /facilitador/oficinas). */
function NovaOficina({ aoSessaoExpirar }: { aoSessaoExpirar: () => void }) {
  const [dados, setDados] = useState(VAZIA)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [tentou, setTentou] = useState(false)
  const invalida = dados.titulo.trim().length < 3 || dados.perguntas.some((p) => p.texto.trim().length < 5)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (invalida) return
    setEnviando(true)
    setErro('')
    try {
      const o = await api.facilitador.criar(dados.titulo.trim(), dados.perguntas)
      navegar(`/facilitador/oficina/${o.id}`)
    } catch (err) {
      if (sessaoExpirou(err)) aoSessaoExpirar()
      else setErro(textoDoErro(err))
      setEnviando(false)
    }
  }

  const mudarPergunta = (i: number, campo: 'texto' | 'referencia', valor: string) =>
    setDados((d) => ({ ...d, perguntas: d.perguntas.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)) }))

  return (
    <form onSubmit={enviar} className="max-w-3xl space-y-8" noValidate>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Nova oficina</h1>
        <p className="text-tinta-2">
          Escolha três perguntas que uma IA sem contexto pode errar ou inventar, e que você consiga conferir numa fonte. Temas
          com mitos conhecidos ou detalhes locais funcionam bem.
        </p>
        <Botao tamanho="p" variante="secundario" onClick={() => setDados(EXEMPLO)}>
          Preencher com o exemplo (Napoleão)
        </Botao>
      </div>

      <Campo rotulo="Título da oficina" erro={tentou && dados.titulo.trim().length < 3 ? 'Dê um título com pelo menos 3 letras.' : undefined}>
        {(p) => (
          <input {...p} value={dados.titulo} onChange={(e) => setDados({ ...dados, titulo: e.target.value })} maxLength={120} className={entradaCls} />
        )}
      </Campo>

      {dados.perguntas.map((pergunta, i) => (
        <fieldset key={i} className="space-y-4 rounded-caixa border bg-superficie p-5">
          <legend className="px-1 text-lg font-semibold">Pergunta {i + 1}</legend>
          <Campo rotulo="Texto da pergunta" erro={tentou && pergunta.texto.trim().length < 5 ? 'Escreva a pergunta.' : undefined}>
            {(p) => (
              <input {...p} value={pergunta.texto} onChange={(e) => mudarPergunta(i, 'texto', e.target.value)} maxLength={300} className={entradaCls} />
            )}
          </Campo>
          <Campo
            rotulo="Resposta de referência (opcional)"
            dica="A resposta conferida, com a fonte. O participante só vê depois de avaliar sozinho."
          >
            {(p) => (
              <textarea
                {...p}
                value={pergunta.referencia}
                onChange={(e) => mudarPergunta(i, 'referencia', e.target.value)}
                rows={3}
                maxLength={3000}
                className={cn(entradaCls, 'resize-y')}
              />
            )}
          </Campo>
        </fieldset>
      ))}

      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div className="flex flex-wrap gap-3">
        <Botao type="submit" variante="primario" carregando={enviando}>
          Criar oficina
        </Botao>
        <a href={href('/facilitador')} className={botaoCls('discreto')}>
          Cancelar
        </a>
      </div>
    </form>
  )
}
