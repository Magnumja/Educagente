/**
 * Cliente da API (`backend/oficinas/api.py`). Toda conversa com o servidor passa por aqui.
 * O participante se identifica pelo token recebido ao entrar (header X-Participante); o
 * facilitador, por um token de sessão (Authorization: Bearer). Nenhum dos dois é a senha
 * nem um id sequencial.
 *
 * Organização: tipos dos dados que o servidor devolve, guarda dos tokens (sessao),
 * a função chamar() que faz o fetch e trata erros, e o objeto api com uma função por rota.
 */

/* ---------------- Tipos dos dados ---------------- */

export type Tentativa = 1 | 2
export type Veredito = 'correta' | 'parcial' | 'errada' | 'nao_sei'
export type Preferencia = 'primeira' | 'segunda' | 'nenhuma'

export interface Pergunta {
  id: number
  ordem: number
  texto: string
}

export interface Trecho {
  documento: string
  pagina: number
  similaridade: number
  texto: string
}

export interface Resposta {
  id: number
  pergunta_id: number
  tentativa: Tentativa
  texto: string
  trechos: Trecho[]
  nada_relevante: boolean
  instrucoes_enviadas: string
  tempo_segundos: number
  criado_em: string
}

export interface TrechoNaBusca extends Trecho {
  ordem: number
  situacao: 'usado' | 'fora_do_limite' | 'abaixo_do_minimo'
}

/** Como cada trecho se saiu numa pergunta (esquema da etapa 3): do mais parecido para o menos. */
export interface Busca {
  total: number
  top_k: number
  limiar: number
  mudou_desde_a_resposta: boolean
  trechos: TrechoNaBusca[]
}

export interface Documento {
  id: number
  nome: string
  origem: 'enviado' | 'colado' | 'sugerido'
  paginas: number
  trechos: number
  copia_de_id: number | null
  criado_em: string
}

export interface Avaliacao {
  pergunta_id: number
  primeira: Veredito
  segunda: Veredito
  mais_confiavel: Preferencia
  conferiu_fonte: boolean
  observacao: string
}

export interface OficinaResumo {
  titulo: string
  codigo: string
  aberta: boolean
}

export interface Estado {
  id: number
  apelido: string
  orientacao: string
  oficina: OficinaResumo
  perguntas: Pergunta[]
  fontes_sugeridas: Documento[]
  documentos: Documento[]
  respostas: Resposta[]
  avaliacoes: Avaliacao[]
  referencias: Record<string, string>
}

export interface Saude {
  ok: boolean
  modelo: string | null
  demonstracao: boolean
  embeddings_locais: boolean
  facilitador_configurado: boolean
}

export interface PerguntaFacilitador extends Pergunta {
  referencia: string
}

export interface OficinaFacilitador {
  id: number
  titulo: string
  codigo: string
  aberta: boolean
  criado_em: string
  total_participantes: number
}

export interface LinhaRelatorio {
  id: number
  apelido: string
  criado_em: string
  fontes: string[]
  orientacao: string
  perguntas: { pergunta_id: number; primeira: Resposta | null; segunda: Resposta | null; avaliacao: Avaliacao | null }[]
}

export interface OficinaDetalhe extends OficinaFacilitador {
  perguntas: PerguntaFacilitador[]
  fontes: Documento[]
  relatorio: LinhaRelatorio[]
}

/* ---------------- Erros ---------------- */

/** Erro de uma chamada: status HTTP (0 = sem conexão) e uma mensagem pronta para mostrar. */
export class ErroApi extends Error {
  status: number
  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

/** Texto para mostrar ao usuário a partir de qualquer erro capturado num catch. */
export function textoDoErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Algo deu errado. Tente de novo.'
}

/** true quando o servidor recusou o token: a sessão terminou ou nunca existiu. */
export function sessaoExpirou(e: unknown): boolean {
  return e instanceof ErroApi && e.status === 401
}

/* ---------------- Tokens guardados no navegador ---------------- */

const CHAVE_PARTICIPANTE = 'educagente:participante'
const CHAVE_FACILITADOR = 'educagente:facilitador'

function ler(chave: string, armazenamento: Storage): string | null {
  try {
    return armazenamento.getItem(chave)
  } catch {
    return null
  }
}

function gravar(chave: string, valor: string | null, armazenamento: Storage) {
  try {
    if (valor === null) armazenamento.removeItem(chave)
    else armazenamento.setItem(chave, valor)
  } catch {
    /* navegador sem armazenamento: a sessão dura até fechar a aba */
  }
}

/** O token do participante fica no localStorage: recarregar ou voltar outro dia mantém o progresso. */
export const sessao = {
  participante: () => ler(CHAVE_PARTICIPANTE, localStorage),
  definirParticipante: (token: string | null) => gravar(CHAVE_PARTICIPANTE, token, localStorage),
  // O token do facilitador some ao fechar a aba: o PC do laboratório é compartilhado.
  facilitador: () => ler(CHAVE_FACILITADOR, sessionStorage),
  definirFacilitador: (token: string | null) => gravar(CHAVE_FACILITADOR, token, sessionStorage),
}

/* ---------------- Chamada genérica ---------------- */

/** Traduz a resposta de erro do servidor numa frase para a pessoa. */
function mensagemDeErro(status: number, corpo: unknown): string {
  if (corpo && typeof corpo === 'object' && 'detail' in corpo) {
    const detalhe = (corpo as { detail: unknown }).detail
    if (typeof detalhe === 'string') return detalhe
    if (Array.isArray(detalhe)) return 'Algum campo não foi preenchido como esperado. Confira e tente de novo.'
  }
  if (status === 401) return 'Sua sessão terminou. Entre de novo.'
  if (status === 429) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'
  if (status >= 500) return 'O servidor da oficina não respondeu. Avise o facilitador.'
  return `Algo deu errado (erro ${status}).`
}

/** Quem está chamando decide qual token vai no header. */
type Quem = 'participante' | 'facilitador' | null

/** Faz o fetch em /api, põe o token certo, e devolve JSON (ou Blob, no CSV). Falhas viram ErroApi. */
async function chamar<T>(caminho: string, opcoes: RequestInit & { quem?: Quem } = {}): Promise<T> {
  const { quem = null, ...init } = opcoes
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (quem === 'participante') headers.set('X-Participante', sessao.participante() ?? '')
  if (quem === 'facilitador') headers.set('Authorization', `Bearer ${sessao.facilitador() ?? ''}`)

  let res: Response
  try {
    res = await fetch(`/api${caminho}`, { ...init, headers })
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor da oficina. Confira a rede ou avise o facilitador.')
  }
  if (!res.ok) {
    const corpo = await res.json().catch(() => null)
    throw new ErroApi(res.status, mensagemDeErro(res.status, corpo))
  }
  if (res.status === 204) return undefined as T
  const tipo = res.headers.get('Content-Type') ?? ''
  return (tipo.includes('json') ? res.json() : res.blob()) as Promise<T>
}

const json = (dados: unknown) => JSON.stringify(dados)

/* ---------------- Uma função por rota ---------------- */

export const api = {
  saude: () => chamar<Saude>('/saude'),
  oficina: (codigo: string) => chamar<OficinaResumo>(`/oficinas/${encodeURIComponent(codigo)}`),

  async entrar(codigo: string, apelido: string) {
    const r = await chamar<{ token: string; estado: Estado }>(`/oficinas/${encodeURIComponent(codigo)}/entrar`, {
      method: 'POST',
      body: json({ apelido, consentimento: true }),
    })
    sessao.definirParticipante(r.token)
    return r.estado
  },

  estado: () => chamar<Estado>('/eu', { quem: 'participante' }),
  perguntar: (pergunta_id: number, tentativa: Tentativa) =>
    chamar<Resposta>('/eu/perguntar', { method: 'POST', quem: 'participante', body: json({ pergunta_id, tentativa }) }),
  enviarArquivo(arquivo: File) {
    const form = new FormData()
    form.set('arquivo', arquivo)
    return chamar<Documento>('/eu/documentos', { method: 'POST', quem: 'participante', body: form })
  },
  colarTexto: (titulo: string, texto: string) =>
    chamar<Documento>('/eu/textos', { method: 'POST', quem: 'participante', body: json({ titulo, texto }) }),
  usarFonteSugerida: (id: number) => chamar<Documento>(`/eu/fontes-sugeridas/${id}`, { method: 'POST', quem: 'participante' }),
  removerDocumento: (id: number) => chamar<void>(`/eu/documentos/${id}`, { method: 'DELETE', quem: 'participante' }),
  salvarOrientacao: (orientacao: string) =>
    chamar<void>('/eu/orientacao', { method: 'PUT', quem: 'participante', body: json({ orientacao }) }),
  busca: (pergunta_id: number) => chamar<Busca>(`/eu/perguntas/${pergunta_id}/busca`, { quem: 'participante' }),
  avaliar: (pergunta_id: number, dados: Omit<Avaliacao, 'pergunta_id'>) =>
    chamar<Avaliacao>(`/eu/avaliacoes/${pergunta_id}`, { method: 'PUT', quem: 'participante', body: json(dados) }),
  async apagarMeusDados() {
    await chamar<void>('/eu', { method: 'DELETE', quem: 'participante' })
    sessao.definirParticipante(null)
  },

  facilitador: {
    async entrar(senha: string) {
      const r = await chamar<{ token: string }>('/facilitador/entrar', { method: 'POST', body: json({ senha }) })
      sessao.definirFacilitador(r.token)
    },
    sair: () => sessao.definirFacilitador(null),
    oficinas: () => chamar<OficinaFacilitador[]>('/facilitador/oficinas', { quem: 'facilitador' }),
    criar: (titulo: string, perguntas: { texto: string; referencia: string }[]) =>
      chamar<OficinaDetalhe>('/facilitador/oficinas', { method: 'POST', quem: 'facilitador', body: json({ titulo, perguntas }) }),
    oficina: (id: number) => chamar<OficinaDetalhe>(`/facilitador/oficinas/${id}`, { quem: 'facilitador' }),
    atualizar: (id: number, dados: { titulo?: string; aberta?: boolean; perguntas?: { texto: string; referencia: string }[] }) =>
      chamar<OficinaDetalhe>(`/facilitador/oficinas/${id}`, { method: 'PATCH', quem: 'facilitador', body: json(dados) }),
    apagar: (id: number) => chamar<void>(`/facilitador/oficinas/${id}`, { method: 'DELETE', quem: 'facilitador' }),
    enviarFonte(id: number, arquivo: File) {
      const form = new FormData()
      form.set('arquivo', arquivo)
      return chamar<Documento>(`/facilitador/oficinas/${id}/fontes`, { method: 'POST', quem: 'facilitador', body: form })
    },
    removerFonte: (id: number, fonteId: number) =>
      chamar<void>(`/facilitador/oficinas/${id}/fontes/${fonteId}`, { method: 'DELETE', quem: 'facilitador' }),
    apagarParticipante: (id: number, participanteId: number) =>
      chamar<void>(`/facilitador/oficinas/${id}/participantes/${participanteId}`, { method: 'DELETE', quem: 'facilitador' }),
    async baixarCsv(id: number, codigo: string) {
      const blob = await chamar<Blob>(`/facilitador/oficinas/${id}/export.csv`, { quem: 'facilitador' })
      baixar(blob, `oficina-${codigo}.csv`)
    },
  },
}

/** Faz o navegador salvar o arquivo recebido (usado no CSV do facilitador). */
function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
