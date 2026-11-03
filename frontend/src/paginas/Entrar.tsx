/**
 * Página #/entrar/CODIGO. Busca a oficina pelo código (GET /oficinas/{codigo}), pede um
 * apelido e o consentimento e, ao enviar, cria o participante e guarda o token dele.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { botaoCls, entradaCls } from '@/components/classes'
import { Aviso, Botao, Caixa, Campo, Carregando } from '@/components/ui'
import { api, textoDoErro, type OficinaResumo } from '@/lib/api'
import { href, navegar } from '@/lib/rota'

export function Entrar({ codigo }: { codigo: string }) {
  const [oficina, setOficina] = useState<OficinaResumo | null>(null)
  const [erroOficina, setErroOficina] = useState('')
  const [apelido, setApelido] = useState('')
  const [aceito, setAceito] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  // Os avisos de campo vazio só aparecem depois da primeira tentativa de enviar.
  const [tentou, setTentou] = useState(false)

  useEffect(() => {
    api
      .oficina(codigo)
      .then(setOficina)
      .catch((e: unknown) => setErroOficina(textoDoErro(e)))
  }, [codigo])

  /** POST /oficinas/{codigo}/entrar: o api.entrar já guarda o token; depois vai para a etapa 1. */
  async function enviar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!apelido.trim() || !aceito) return
    setEnviando(true)
    setErro('')
    try {
      await api.entrar(codigo, apelido.trim())
      navegar('/oficina/1')
    } catch (err) {
      setErro(textoDoErro(err))
    } finally {
      setEnviando(false)
    }
  }

  if (erroOficina)
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Aviso tom="erro" titulo="Não achamos essa oficina">
          {erroOficina}
        </Aviso>
        <a href={href('/')} className={botaoCls('secundario')}>
          Digitar o código de novo
        </a>
      </div>
    )
  if (!oficina) return <div className="mx-auto max-w-xl"><Carregando /></div>

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-sm font-semibold tracking-widest text-tinta-2">{oficina.codigo}</p>
        <h1 className="text-3xl font-bold tracking-tight">{oficina.titulo}</h1>
      </div>

      {!oficina.aberta ? (
        <Aviso tom="alerta" titulo="Esta oficina está fechada">
          O facilitador não está aceitando novos participantes. Peça para ele reabrir.
        </Aviso>
      ) : (
        <Caixa>
          <form onSubmit={enviar} className="space-y-6" noValidate>
            <Campo
              rotulo="Como quer ser chamado?"
              dica="Use um apelido. Não precisa (e é melhor não) colocar seu nome completo."
              erro={tentou && !apelido.trim() ? 'Escolha um apelido para continuar.' : undefined}
            >
              {(props) => (
                <input
                  {...props}
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                  maxLength={40}
                  autoComplete="nickname"
                  className={entradaCls}
                />
              )}
            </Campo>

            <fieldset className="space-y-3 rounded-caixa border bg-superficie-2 p-4">
              <legend className="flex items-center gap-2 px-1 font-semibold">
                <ShieldCheck className="size-5 text-acao" aria-hidden /> Seus dados
              </legend>
              <ul className="list-disc space-y-1.5 pl-5 text-[0.95rem] text-tinta-2">
                <li>Guardamos só o apelido, as respostas da IA, as fontes que você adicionar e a sua avaliação.</li>
                <li>Isso é usado pela equipe do projeto para estudar como as pessoas avaliam a IA, sem identificar ninguém.</li>
                <li>Não envie documentos com dados pessoais (nome completo, CPF, endereço, fotos).</li>
                <li>Você pode apagar tudo a qualquer momento, no fim da oficina.</li>
              </ul>
              <label className="flex items-start gap-3 font-medium">
                <input
                  type="checkbox"
                  checked={aceito}
                  onChange={(e) => setAceito(e.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-[var(--acao)]"
                  aria-invalid={tentou && !aceito ? true : undefined}
                />
                Entendi e concordo em participar.
              </label>
              {tentou && !aceito && <p className="text-sm text-erro">Para participar, marque que concorda.</p>}
            </fieldset>

            {erro && <Aviso tom="erro">{erro}</Aviso>}

            <Botao type="submit" variante="primario" carregando={enviando} className="w-full">
              Começar a oficina <ArrowRight className="size-4" aria-hidden />
            </Botao>
          </form>
        </Caixa>
      )}
    </div>
  )
}
