/** Tela final da oficina (#/oficina/concluida): parabéns e agradecimento, sem a trilha ao lado. */
import { ArrowLeft, Home, PartyPopper } from 'lucide-react'
import { botaoCls } from '@/components/classes'
import { Botao, Caixa } from '@/components/ui'
import { sessao, type Estado } from '@/lib/api'
import { href, navegar } from '@/lib/rota'

export function Concluida({ estado }: { estado: Estado }) {
  /** O PC do laboratório é compartilhado: sair esquece o token, e o próximo aluno não cai nas respostas deste. */
  function sair() {
    sessao.definirParticipante(null)
    navegar('/')
  }

  return (
    <div className="mx-auto max-w-2xl py-6 sm:py-12">
      <Caixa className="space-y-6 p-8 text-center sm:p-12">
        <span className="estalo mx-auto grid size-20 place-items-center rounded-full bg-acao-suave text-acao" aria-hidden>
          <PartyPopper className="size-10" />
        </span>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Parabéns, {estado.apelido}!</h1>
          <p className="text-lg text-tinta-2">
            Você concluiu a oficina <strong className="text-tinta">{estado.oficina.titulo}</strong>. Obrigado por participar!
          </p>
        </div>
        <p className="text-tinta-2">
          Agora você já sabe o principal: quando a IA responder com segurança, confira de onde veio a informação.
        </p>
        <p className="text-sm text-tinta-2">
          Suas respostas e avaliações já estão salvas e aparecem para o facilitador. Ao ir para a tela inicial, este navegador
          sai da oficina.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a href={href('/oficina/5')} className={botaoCls('secundario')}>
            <ArrowLeft className="size-4" aria-hidden /> Voltar à etapa 5
          </a>
          <Botao variante="primario" onClick={sair}>
            <Home className="size-4" aria-hidden /> Ir para a tela inicial
          </Botao>
        </div>
      </Caixa>
    </div>
  )
}
