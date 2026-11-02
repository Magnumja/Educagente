from datetime import datetime

from ninja import Field, Schema


class NovoProjeto(Schema):
    nome: str = Field(min_length=1, max_length=80)
    descricao: str | None = Field(default=None, max_length=500)
    model_provider: str = "ollama"
    cenario_id: str | None = None


class AtualizarProjeto(Schema):
    prompt_persona: str | None = Field(default=None, max_length=2000)
    prompt_context: str | None = Field(default=None, max_length=2000)
    prompt_instruction: str | None = Field(default=None, max_length=2000)
    prompt_restriction: str | None = Field(default=None, max_length=2000)
    prompt_output_format: str | None = Field(default=None, max_length=2000)
    chunk_max_chars: int | None = Field(default=None, ge=100, le=4000)
    chunk_overlap_chars: int | None = Field(default=None, ge=0, le=1000)
    top_k: int | None = Field(default=None, ge=1, le=20)
    similarity_threshold: float | None = Field(default=None, ge=0, le=1)


class PerguntaProjeto(Schema):
    pergunta: str = Field(min_length=1, max_length=1000)


class DocumentoOut(Schema):
    id: int
    nome_arquivo: str
    paginas: int
    chunk_count: int
    status: str
    criado_em: datetime


class ProjetoOut(Schema):
    id: int
    aluno_id: int
    nome: str
    descricao: str | None
    cenario_id: str | None
    model_provider: str
    model_name: str
    embedding_model: str
    prompt_persona: str
    prompt_context: str
    prompt_instruction: str
    prompt_restriction: str
    prompt_output_format: str
    chunk_max_chars: int
    chunk_overlap_chars: int
    top_k: int
    similarity_threshold: float
    criado_em: datetime
    atualizado_em: datetime


class ProjetoComDocumentosOut(ProjetoOut):
    documentos: list[DocumentoOut]


class RespostaOut(Schema):
    id: int
    pergunta: str
    modo: str
    resposta: str
    trechos: list[dict]
    tempo_segundos: float
    tokens_in: int
    tokens_out: int
    nada_relevante: bool
    criado_em: datetime


class ComparacaoOut(Schema):
    pergunta: str
    camadas: dict[str, RespostaOut]
