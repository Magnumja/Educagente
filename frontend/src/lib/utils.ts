export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function plural(n: number, singular: string, pluralForma = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralForma}`
}

export function porcentagem(valor: number) {
  return `${Math.round(valor * 100)}%`
}
