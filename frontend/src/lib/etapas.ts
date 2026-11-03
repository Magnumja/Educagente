import type { Estado } from './api'

export const ETAPAS = [
  { n: 1, curto: 'Sem contexto', titulo: 'Pergunte sem contexto' },
  { n: 2, curto: 'Fontes', titulo: 'Adicione fontes confiáveis' },
  { n: 3, curto: 'Com fontes', titulo: 'Pergunte de novo' },
  { n: 4, curto: 'Comparar', titulo: 'Compare e confira' },
  { n: 5, curto: 'NotebookLM', titulo: 'Estude com o NotebookLM' },
] as const

export function progresso(estado: Estado): Record<number, boolean> {
  const total = estado.perguntas.length
  const feitas = (t: number) => estado.respostas.filter((r) => r.tentativa === t).length
  return {
    1: feitas(1) >= total,
    2: estado.documentos.length > 0,
    3: feitas(2) >= total,
    4: estado.avaliacoes.length >= total,
    5: false,
  }
}
