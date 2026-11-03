/**
 * Peças de interface usadas em todas as telas: Botao, Aviso, Dica, Campo, Segmentado,
 * Caixa, NumeroDoPasso e Carregando. As classes soltas (botaoCls, entradaCls, larguraCls)
 * ficam em classes.ts.
 */
import { useId, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, Lightbulb, Loader2, XCircle, type LucideIcon } from 'lucide-react'
import { botaoCls, type TamanhoDoBotao, type Variante } from '@/components/classes'
import { cn } from '@/lib/utils'

/* ---------------- Botões ---------------- */

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamanho?: TamanhoDoBotao
  carregando?: boolean
}

/** Botão padrão. Com carregando, mostra o giro e fica desabilitado para evitar clique duplo. */
export function Botao({ variante = 'secundario', tamanho = 'm', carregando, className, children, disabled, ...resto }: BotaoProps) {
  return (
    <button
      type="button"
      {...resto}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(botaoCls(variante, tamanho), className)}
    >
      {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

/* ---------------- Avisos ---------------- */

type Tom = 'info' | 'alerta' | 'erro' | 'ok'

const TONS: Record<Tom, { cls: string; Icone: LucideIcon; cor: string }> = {
  info: { cls: 'bg-acao-suave border-acao/25', Icone: Info, cor: 'text-acao' },
  alerta: { cls: 'bg-alerta-fundo border-alerta/35', Icone: AlertTriangle, cor: 'text-alerta' },
  erro: { cls: 'bg-erro-fundo border-erro/35', Icone: XCircle, cor: 'text-erro' },
  ok: { cls: 'bg-ok-fundo border-ok/35', Icone: CheckCircle2, cor: 'text-ok' },
}

/** Mensagem de status (info, alerta, erro, ok). Erro usa role="alert" para o leitor de tela anunciar na hora. */
export function Aviso({ tom = 'info', titulo, children, className }: { tom?: Tom; titulo?: string; children?: ReactNode; className?: string }) {
  const { cls, Icone, cor } = TONS[tom]
  return (
    <div role={tom === 'erro' ? 'alert' : 'status'} className={cn('surgir flex gap-3 rounded-caixa border p-4 text-[0.95rem] text-tinta', cls, className)}>
      <Icone className={cn('mt-0.5 size-5 shrink-0', cor)} aria-hidden />
      <div className="min-w-0 space-y-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="text-tinta-2 [&_strong]:text-tinta">{children}</div>}
      </div>
    </div>
  )
}

/** Cartão de dica: uma ideia por vez, com ícone grande. Para o que é bom saber, mas não é a tarefa. */
export function Dica({
  Icone = Lightbulb,
  titulo,
  children,
  className,
  style,
}: {
  Icone?: LucideIcon
  titulo: string
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <aside style={style} className={cn('surgir flex gap-4 rounded-caixa border border-acao/20 bg-acao-suave/60 p-5', className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie text-acao shadow-caixa" aria-hidden>
        <Icone className="size-5" />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{titulo}</p>
        <div className="text-tinta-2 [&_strong]:text-tinta">{children}</div>
      </div>
    </aside>
  )
}

/* ---------------- Formulário ---------------- */

/**
 * Rótulo + campo + dica/erro, já ligados por id para acessibilidade. O campo vem como função
 * (render prop) porque quem chama escolhe se é input ou textarea, e o Campo só entrega os atributos.
 */
export function Campo({
  rotulo,
  dica,
  erro,
  children,
}: {
  rotulo: string
  dica?: ReactNode
  erro?: string
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
}) {
  const id = useId()
  const dicaId = dica || erro ? `${id}-dica` : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-semibold">
        {rotulo}
      </label>
      {children({ id, 'aria-describedby': dicaId, 'aria-invalid': erro ? true : undefined })}
      {(dica || erro) && (
        <p id={dicaId} className={cn('text-sm', erro ? 'text-erro' : 'text-tinta-2')}>
          {erro ?? dica}
        </p>
      )}
    </div>
  )
}

/** Grupo de opções exclusivas (rádios) com aparência de botões segmentados. */
export function Segmentado<T extends string>({
  legenda,
  valor,
  opcoes,
  aoMudar,
  compacto,
}: {
  legenda: string
  valor: T | null
  opcoes: { valor: T; rotulo: string }[]
  aoMudar: (v: T) => void
  compacto?: boolean
}) {
  const nome = useId()
  return (
    <fieldset className="min-w-0">
      <legend className={cn('mb-2 font-semibold', compacto && 'text-sm')}>{legenda}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <label
            key={o.valor}
            className={cn(
              'relative inline-flex items-center rounded-p border-[1.5px] font-medium',
              'transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97]',
              'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foco',
              compacto ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-4',
              valor === o.valor
                ? 'border-acao bg-acao text-acao-tinta shadow-[0_4px_12px_-6px_var(--acao)]'
                : 'border-linha-forte bg-superficie text-tinta hover:border-tinta-2 hover:bg-superficie-2',
            )}
          >
            <input
              type="radio"
              name={nome}
              value={o.valor}
              checked={valor === o.valor}
              onChange={() => aoMudar(o.valor)}
              className="sr-only"
            />
            {o.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/* ---------------- Estrutura ---------------- */

/** Cartão branco com borda e sombra; interativa faz levantar no hover. */
export function Caixa({
  children,
  className,
  as: Tag = 'section',
  interativa,
  style,
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'article' | 'div' | 'li'
  interativa?: boolean
  style?: CSSProperties
}) {
  return (
    <Tag style={style} className={cn('rounded-caixa border bg-superficie p-5 shadow-caixa sm:p-6', interativa && 'levanta', className)}>
      {children}
    </Tag>
  )
}

const TONS_PASSO = {
  acao: 'bg-acao text-acao-tinta',
  ok: 'bg-ok text-superficie',
  neutro: 'bg-superficie-2 text-tinta-2 border border-linha-forte',
}

/** Número de passo em círculo, para sequências reais (1, 2, 3). */
export function NumeroDoPasso({ n, tom = 'acao', className }: { n: number | string; tom?: keyof typeof TONS_PASSO; className?: string }) {
  return (
    <span
      className={cn('grid size-9 shrink-0 place-items-center rounded-full font-mono text-sm font-bold transition-colors duration-300', TONS_PASSO[tom], className)}
      aria-hidden
    >
      {n}
    </span>
  )
}

function Esqueleto({ className }: { className?: string }) {
  return <div className={cn('brilho-carregando rounded-p', className)} aria-hidden />
}

/** Esqueleto com brilho enquanto a página busca os dados. */
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{texto}</span>
      <Esqueleto className="h-8 w-2/3" />
      <Esqueleto className="h-4 w-full" />
      <Esqueleto className="h-4 w-5/6" />
      <Esqueleto className="h-40 w-full" />
    </div>
  )
}
