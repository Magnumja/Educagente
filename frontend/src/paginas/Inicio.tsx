/**
 * Página inicial (#/). Quem ainda não entrou digita o código da oficina; quem já tem token
 * salvo vê "Continuar de onde parei". Também resume a oficina e tem a ilustração animada.
 */
import { useState, type FormEvent } from 'react'
import { ArrowRight, BookMarked, Bot, FileText, GraduationCap, MessageSquareDashed, Scale, User } from 'lucide-react'
import { botaoCls, entradaCls } from '@/components/classes'
import { Botao, Caixa, Campo } from '@/components/ui'
import { sessao } from '@/lib/api'
import { href, navegar } from '@/lib/rota'
import { atraso } from '@/lib/utils'

/** Os quatro passos mostrados em "Como é a oficina" (resumo das etapas, para quem ainda não entrou). */
const PASSOS = [
  { Icone: MessageSquareDashed, titulo: 'Pergunte sem contexto', texto: 'Três perguntas a uma IA que só conta com o que aprendeu no treino.' },
  { Icone: BookMarked, titulo: 'Dê fontes confiáveis', texto: 'Textos ou documentos que você consegue conferir.' },
  { Icone: Scale, titulo: 'Compare as respostas', texto: 'As mesmas perguntas, agora com fontes. Qual se sustenta?' },
  { Icone: GraduationCap, titulo: 'Leve para o estudo', texto: 'Use o mesmo cuidado no NotebookLM, com o seu material.' },
]

export function Inicio() {
  const temSessao = !!sessao.participante()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')

  /** Valida o código no navegador e vai para #/entrar/CODIGO, onde a oficina é buscada no servidor. */
  function entrar(e: FormEvent) {
    e.preventDefault()
    const limpo = codigo.replace(/[^a-z0-9]/gi, '').toUpperCase()
    if (limpo.length !== 6) {
      setErro('O código tem 6 letras e números. Ele aparece na tela do facilitador.')
      return
    }
    navegar(`/entrar/${limpo}`)
  }

  return (
    <div className="space-y-20">
      <section className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border bg-superficie px-3 py-1 text-sm font-medium text-tinta-2 shadow-caixa">
            <span className="size-2 rounded-full bg-ok" aria-hidden /> Oficina de 30 a 60 minutos · sem programar
          </p>
          <h1 className="max-w-[16ch] text-[2.3rem] font-bold leading-[1.1] tracking-tight sm:text-[3.4rem]">
            A IA responde com segurança. <span className="text-acao">Isso não quer dizer que ela acertou.</span>
          </h1>
          <p className="max-w-[52ch] text-lg text-tinta-2">
            Você vai comparar respostas de uma IA <strong className="text-tinta">sem contexto</strong> e{' '}
            <strong className="text-tinta">com fontes</strong>, e aprender a conferir de onde veio cada informação.
          </p>

          <Caixa as="div" className="max-w-md">
            {temSessao ? (
              <div className="space-y-4">
                <h2 className="text-lg font-bold">Você já está numa oficina</h2>
                <p className="text-tinta-2">Seu progresso ficou salvo neste navegador.</p>
                <a href={href('/oficina')} className={botaoCls('primario')}>
                  Continuar de onde parei <ArrowRight className="size-4" aria-hidden />
                </a>
              </div>
            ) : (
              <form onSubmit={entrar} className="space-y-4" noValidate>
                <Campo rotulo="Código da oficina" dica="Está na tela projetada pelo facilitador." erro={erro || undefined}>
                  {(props) => (
                    <input
                      {...props}
                      value={codigo}
                      onChange={(e) => {
                        setCodigo(e.target.value.toUpperCase())
                        setErro('')
                      }}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={7}
                      placeholder="Ex.: K7P2QX"
                      className={`${entradaCls} font-mono text-2xl tracking-[0.2em] uppercase placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:normal-case`}
                    />
                  )}
                </Campo>
                <Botao type="submit" variante="primario" className="w-full">
                  Entrar na oficina <ArrowRight className="size-4" aria-hidden />
                </Botao>
              </form>
            )}
          </Caixa>
        </div>

        <Ilustracao />
      </section>

      <section aria-labelledby="como-e" className="space-y-8">
        <div className="space-y-2 text-center">
          <h2 id="como-e" className="text-3xl font-bold tracking-tight">
            Como é a oficina
          </h2>
          <p className="text-tinta-2">Quatro passos curtos. Um de cada vez.</p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map(({ Icone, titulo, texto }, i) => (
            <Caixa as="li" key={titulo} interativa className="surgir space-y-3" style={atraso(i)}>
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-acao-suave text-acao" aria-hidden>
                  <Icone className="size-5" />
                </span>
                <span className="font-mono text-2xl font-bold text-linha-forte" aria-hidden>
                  {i + 1}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{titulo}</h3>
              <p className="text-tinta-2">{texto}</p>
            </Caixa>
          ))}
        </ol>
        <p className="text-center text-tinta-2">
          Quer entender o que acontece por dentro?{' '}
          <a href={href('/como-funciona')} className="font-semibold text-acao underline underline-offset-4">
            Veja como a IA usa fontes
          </a>
        </p>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm text-tinta-2">
        <span>Projeto de extensão: inclusão digital crítica e uso consciente de IA.</span>
        <a href={href('/facilitador')} className="font-semibold text-acao underline underline-offset-4">
          Área do facilitador
        </a>
      </footer>
    </div>
  )
}

/** A ideia da oficina num desenho: a mesma pergunta, uma resposta sem fonte e outra com fonte. */
function Ilustracao() {
  return (
    <div className="relative mx-auto w-full max-w-lg" aria-hidden>
      <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(closest-side,var(--brilho),transparent)]" />
      <div className="relative space-y-4 rounded-[1.5rem] border bg-superficie p-5 shadow-alta sm:p-6">
        <div className="surgir flex justify-end gap-2" style={atraso(0)}>
          <p className="max-w-[80%] rounded-2xl rounded-tr-md bg-acao px-4 py-2.5 font-medium text-acao-tinta">
            Napoleão chegou a visitar o Brasil?
          </p>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-superficie-2 text-tinta-2">
            <User className="size-4" />
          </span>
        </div>

        <div className="surgir flex gap-2" style={atraso(3)}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-linha-forte text-tinta-2">
            <Bot className="size-4" />
          </span>
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-linha-forte px-2 py-0.5 text-xs font-medium text-tinta-2">
              <MessageSquareDashed className="size-3" /> Sem fonte
            </span>
            <p className="rounded-2xl rounded-tl-md border border-dashed border-linha-forte bg-superficie-2/60 px-4 py-2.5 text-[0.95rem]">
              Sim, em 1808 ele acompanhou a corte até o Rio de Janeiro.
            </p>
            <p className="pl-1 text-xs font-semibold text-erro">✗ Inventado, e dito com toda a segurança</p>
          </div>
        </div>

        <div className="surgir flex gap-2" style={atraso(7)}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-acao text-acao-tinta">
            <Bot className="size-4" />
          </span>
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-evidencia-tinta/40 bg-evidencia px-2 py-0.5 text-xs font-medium">
              <BookMarked className="size-3" /> Com fontes
            </span>
            <p className="rounded-2xl rounded-tl-md bg-superficie-2 px-4 py-2.5 text-[0.95rem]">
              Não. Ele nunca esteve no Brasil; foi a invasão de Portugal que trouxe a corte{' '}
              <span className="rounded bg-evidencia px-1 font-mono text-xs font-bold">1</span>
            </p>
            <p className="flex items-center gap-1.5 pl-1 text-xs text-tinta-2">
              <FileText className="size-3" />
              <span className="marca-texto font-medium text-tinta" style={atraso(6)}>
                napoleao.txt, página 1
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
