/**
 * Conjuntos de classes do Tailwind reaproveitados em várias telas. Ficam fora do ui.tsx
 * porque às vezes o mesmo visual vai num <a> (link com cara de botão) e não num <button>.
 */
import { cn } from '@/lib/utils'

/** Largura das páginas: usa a tela toda, com margens que crescem junto com ela. */
export const larguraCls = 'mx-auto w-full max-w-[110rem] px-4 sm:px-6 lg:px-10'

/** Visual de campo de texto (input e textarea). */
export const entradaCls =
  'w-full rounded-p border-[1.5px] border-linha-forte bg-superficie px-3.5 py-2.5 text-tinta placeholder:text-tinta-2 ' +
  'transition-[border-color,box-shadow] duration-200 hover:border-tinta-2 focus:border-acao focus:shadow-[0_0_0_4px_var(--acao-suave)] focus:outline-none ' +
  'aria-invalid:border-erro disabled:opacity-60'

export type Variante = 'primario' | 'secundario' | 'discreto' | 'perigo'
export type TamanhoDoBotao = 'p' | 'm'

const VARIANTES: Record<Variante, string> = {
  primario:
    'bg-acao text-acao-tinta hover:bg-acao-hover border-transparent shadow-[0_6px_16px_-6px_var(--acao)] hover:shadow-[0_10px_22px_-8px_var(--acao)]',
  secundario: 'bg-superficie text-tinta border-linha-forte hover:bg-superficie-2 hover:border-tinta-2',
  discreto: 'bg-transparent text-acao border-transparent hover:bg-acao-suave',
  perigo: 'bg-superficie text-erro border-erro/60 hover:bg-erro-fundo',
}

/** Visual de botão; usado pelo <Botao> e por links que precisam parecer botão. */
export function botaoCls(variante: Variante = 'secundario', tamanho: TamanhoDoBotao = 'm') {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-p border-[1.5px] font-semibold',
    'transition-[background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.97]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100',
    tamanho === 'm' ? 'min-h-11 px-5 py-2 text-[0.95rem]' : 'min-h-9 px-3 py-1.5 text-sm',
    VARIANTES[variante],
  )
}
