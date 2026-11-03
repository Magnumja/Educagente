/** Tipos compartilhados pelas partes da tela de uma oficina do facilitador (DetalheDaOficina). */
import type { OficinaDetalhe } from '@/lib/api'

/** Roda uma ação na API e recarrega a oficina; erros viram aviso e 401 encerra a sessão. */
export type Executar = (acao: () => Promise<unknown>) => Promise<void>

/** O que cada parte recebe: a oficina carregada e o executar() da tela. */
export interface PropsDaParte {
  oficina: OficinaDetalhe
  executar: Executar
}
