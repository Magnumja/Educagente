/** Opções da avaliação da etapa 4 (valor enviado à API + rótulo mostrado na tela). */
import type { Preferencia, Veredito } from '@/lib/api'

export const VEREDITOS: { valor: Veredito; rotulo: string }[] = [
  { valor: 'correta', rotulo: 'Correta' },
  { valor: 'parcial', rotulo: 'Em parte' },
  { valor: 'errada', rotulo: 'Errada' },
  { valor: 'nao_sei', rotulo: 'Não sei dizer' },
]

export const PREFERENCIAS: { valor: Preferencia; rotulo: string }[] = [
  { valor: 'primeira', rotulo: 'A sem contexto' },
  { valor: 'segunda', rotulo: 'A com fontes' },
  { valor: 'nenhuma', rotulo: 'Nenhuma das duas' },
]
