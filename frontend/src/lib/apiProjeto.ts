/**
 * Cliente do modelo "Projeto" — espelha 1:1 os endpoints de `backend/projetos/api.py`
 * (prefixo `/api/alunos/{aluno_id}/projetos`). Reaproveita o aluno anônimo já
 * criado por `lib/api.ts` (mesma chave de localStorage).
 *
 * BYOK: a chave do aluno nunca é lida daqui direto — quem chama `perguntar`/
 * `comparar` passa o provedor do projeto, e a chave correspondente (se houver)
 * é buscada em `lib/chavesIA.ts` e anexada só nessa requisição, via header.
 */
import { obterChave, type ProvedorIA } from './chavesIA'

export interface ProjetoDocumento {
  id: number
  nome_arquivo: string
  paginas: number
  chunk_count: number
  status: string
  criado_em: string
}

export interface Projeto {
  id: number
  aluno_id: number
  nome: string
  descricao: string | null
  cenario_id: string | null
  model_provider: string
  model_name: string
  embedding_model: string
  prompt_persona: string
  prompt_context: string
  prompt_instruction: string
  prompt_restriction: string
  prompt_output_format: string
  chunk_max_chars: number
  chunk_overlap_chars: number
  top_k: number
  similarity_threshold: number
  criado_em: string
  atualizado_em: string
  documentos?: ProjetoDocumento[]
}

export interface TrechoProjeto {
  texto: string
  documento: string
  pagina: number
  similaridade: number
}

export type ModoResposta = 'puro' | 'prompt' | 'prompt_rag'

export interface RespostaProjeto {
  id: number
  modo: ModoResposta
  resposta: string
  trechos: TrechoProjeto[]
  tempo_segundos: number
  tokens_in: number
  tokens_out: number
  nada_relevante: boolean
}

export interface ComparacaoProjeto {
  pergunta: string
  camadas: Partial<Record<ModoResposta, RespostaProjeto>>
}

export const LIMITE_PROJETOS = 3

const CHAVE_ALUNO = 'oficina-rag:aluno-id'

/** O aluno anônimo já foi criado por `lib/api.ts` (chamado em `detectar()`/`App.tsx`
 * ao montar); aqui só lemos o id salvo. */
async function aluno(): Promise<number> {
  const salvo = Number(localStorage.getItem(CHAVE_ALUNO))
  if (salvo) return salvo
  const { api } = await import('./api')
  await api.trechos().catch(() => {})
  const depois = Number(localStorage.getItem(CHAVE_ALUNO))
  if (depois) return depois
  throw new Error('Aluno não identificado ainda. Recarregue a página.')
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const a = await aluno()
  const res = await fetch(`/api/alunos/${a}/projetos${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    let msg = `Erro ${res.status}`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') msg = body.detail
    } catch {
      /* resposta sem JSON */
    }
    throw new Error(msg)
  }
  return res.json()
}

function headerChave(provider: ProvedorIA): Record<string, string> {
  const chave = obterChave(provider)
  return chave ? { 'X-Provider-Api-Key': chave } : {}
}

export const apiProjeto = {
  listarProjetos: () => req<Projeto[]>(''),

  criarProjeto: (nome: string, modelProvider: ProvedorIA, descricao?: string) =>
    req<Projeto>('', {
      method: 'POST',
      body: JSON.stringify({ nome, descricao: descricao || null, model_provider: modelProvider }),
    }),

  verProjeto: (projetoId: number) => req<Projeto>(`/${projetoId}`),

  atualizarProjeto: (
    projetoId: number,
    campos: Partial<
      Pick<
        Projeto,
        | 'prompt_persona'
        | 'prompt_context'
        | 'prompt_instruction'
        | 'prompt_restriction'
        | 'prompt_output_format'
        | 'chunk_max_chars'
        | 'chunk_overlap_chars'
        | 'top_k'
        | 'similarity_threshold'
      >
    >,
  ) => req<Projeto>(`/${projetoId}`, { method: 'PATCH', body: JSON.stringify(campos) }),

  async enviarDocumento(projetoId: number, arquivo: File) {
    const a = await aluno()
    const form = new FormData()
    form.set('arquivo', arquivo)
    const res = await fetch(`/api/alunos/${a}/projetos/${projetoId}/documentos`, { method: 'POST', body: form })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(typeof body.detail === 'string' ? body.detail : `Erro ${res.status}`)
    }
    return res.json() as Promise<ProjetoDocumento>
  },

  perguntar: (projetoId: number, pergunta: string, provider: ProvedorIA) =>
    req<RespostaProjeto>(`/${projetoId}/perguntar`, {
      method: 'POST',
      body: JSON.stringify({ pergunta }),
      headers: headerChave(provider),
    }),

  comparar: (projetoId: number, pergunta: string, provider: ProvedorIA) =>
    req<{ pergunta: string; camadas: Record<ModoResposta, RespostaProjeto> }>(`/${projetoId}/comparar`, {
      method: 'POST',
      body: JSON.stringify({ pergunta }),
      headers: headerChave(provider),
    }),

  comparacoes: (projetoId: number) => req<ComparacaoProjeto[]>(`/${projetoId}/comparacoes`),

  async exportar(projetoId: number, nomeProjeto: string) {
    const a = await aluno()
    const res = await fetch(`/api/alunos/${a}/projetos/${projetoId}/exportar`)
    if (!res.ok) throw new Error(`Erro ${res.status} ao exportar`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url
    el.download = `projeto-${projetoId}-${nomeProjeto.trim().toLowerCase().replace(/\s+/g, '-')}.zip`
    el.click()
    URL.revokeObjectURL(url)
  },

  /** Testa a chave antes de salvar — não passa por `req()` porque não é um
   * endpoint de projeto (não tem aluno/projeto_id na URL). */
  async validarChave(provider: 'anthropic' | 'openai', apiKey: string): Promise<{ ok: boolean; erro?: string }> {
    const res = await fetch('/api/validar-chave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: apiKey }),
    })
    if (!res.ok) return { ok: false, erro: `Erro ${res.status}` }
    return res.json()
  },
}
