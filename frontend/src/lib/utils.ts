/** Funções pequenas usadas em várias telas: juntar classes, plural, porcentagem e atraso de animação. */
import type { CSSProperties } from 'react'

/** Junta classes do Tailwind ignorando as condicionais falsas: cn('a', ativo && 'b'). */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

/** "1 trecho", "3 trechos". */
export function plural(n: number, singular: string, pluralForma = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralForma}`
}

/** 0.42 vira "42%". */
export function porcentagem(valor: number) {
  return `${Math.round(valor * 100)}%`
}

/**
 * Posição do elemento na fila de animação. As classes .surgir e .marca-texto do index.css
 * leem a variável --i para atrasar cada item, e assim uma lista entra em sequência.
 */
export function atraso(i: number): CSSProperties {
  return { '--i': i } as CSSProperties
}
