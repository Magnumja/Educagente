/**
 * As cinco etapas da oficina do participante e a regra de quando cada uma conta como feita.
 * Usado pela barra lateral (Trilha), pelo cabeçalho de cada etapa e para decidir
 * em qual etapa a pessoa cai ao abrir #/oficina sem número. Também tem consultas simples ao estado.
 */
import { BookMarked, GraduationCap, MessageSquareDashed, Scale, SearchCheck } from 'lucide-react'
import type { Estado, Resposta, Tentativa } from './api'

export const ETAPAS = [
  { n: 1, curto: 'Sem contexto', titulo: 'Pergunte sem contexto', Icone: MessageSquareDashed },
  { n: 2, curto: 'Fontes', titulo: 'Adicione fontes confiáveis', Icone: BookMarked },
  { n: 3, curto: 'Com fontes', titulo: 'Pergunte de novo', Icone: SearchCheck },
  { n: 4, curto: 'Comparar', titulo: 'Compare e confira', Icone: Scale },
  { n: 5, curto: 'NotebookLM', titulo: 'Estude com o NotebookLM', Icone: GraduationCap },
] as const

/** Etapas que entram na barra de progresso. A 5 (NotebookLM) é leitura e não tem "concluída". */
export const ETAPAS_COM_PROGRESSO = [1, 2, 3, 4] as const

/** Quais etapas já estão feitas, calculado só a partir do estado vindo do servidor (GET /eu). */
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

/** Primeira etapa ainda não feita; com tudo pronto, a 5. */
export function etapaAtual(estado: Estado): number {
  const feito = progresso(estado)
  return ETAPAS_COM_PROGRESSO.find((n) => !feito[n]) ?? 5
}

/** Resposta salva de uma pergunta numa tentativa (1 sem contexto, 2 com fontes), se já existir. */
export function respostaDe(estado: Estado, perguntaId: number, tentativa: Tentativa): Resposta | undefined {
  return estado.respostas.find((r) => r.pergunta_id === perguntaId && r.tentativa === tentativa)
}
