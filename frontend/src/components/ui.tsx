import { useId, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, Lightbulb, Loader2, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Largura das páginas: usa a tela toda, com margens que crescem junto com ela. */
export const larguraCls = 'mx-auto w-full max-w-[110rem] px-4 sm:px-6 lg:px-10'

/* ---------------- Botões ---------------- */

type Variante = 'primario' | 'secundario' | 'discreto' | 'perigo'

const VARIANTES: Record<Variante, string> = {
  primario:
    'bg-acao text-acao-tinta hover:bg-acao-hover border-transparent shadow-[0_6px_16px_-6px_var(--acao)] hover:shadow-[0_10px_22px_-8px_var(--acao)]',
  secundario: 'bg-superficie text-tinta border-linha-forte hover:bg-superficie-2 hover:border-tinta-2',
  discreto: 'bg-transparent text-acao border-transparent hover:bg-acao-suave',
  perigo: 'bg-superficie text-erro border-erro/60 hover:bg-erro-fundo',
}

export function botaoCls(variante: Variante = 'secundario', tamanho: 'p' | 'm' = 'm') {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-p border-[1.5px] font-semibold',
    'transition-[background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.97]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100',
    tamanho === 'm' ? 'min-h-11 px-5 py-2 text-[0.95rem]' : 'min-h-9 px-3 py-1.5 text-sm',
    VARIANTES[variante],
  )
}

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamanho?: 'p' | 'm'
  carregando?: boolean
}

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

export const entradaCls =
  'w-full rounded-p border-[1.5px] border-linha-forte bg-superficie px-3.5 py-2.5 text-tinta placeholder:text-tinta-2 ' +
  'transition-[border-color,box-shadow] duration-200 hover:border-tinta-2 focus:border-acao focus:shadow-[0_0_0_4px_var(--acao-suave)] focus:outline-none ' +
  'aria-invalid:border-erro disabled:opacity-60'

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

/** Número de passo em círculo, para sequências reais (1, 2, 3). */
const TONS_PASSO = {
  acao: 'bg-acao text-acao-tinta',
  ok: 'bg-ok text-superficie',
  neutro: 'bg-superficie-2 text-tinta-2 border border-linha-forte',
}

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

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn('brilho-carregando rounded-p', className)} aria-hidden />
}

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
