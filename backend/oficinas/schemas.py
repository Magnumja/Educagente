"""Formato dos dados que entram e saem da API (contratos com o frontend).

Schemas "...In" validam o corpo dos pedidos: o Django Ninja recusa com 422 o que não
bate (tamanho, tipo, valores permitidos) antes de qualquer regra rodar. Schemas "...Out"
escolhem quais campos de cada objeto vão para o navegador, e nada além deles sai.

Quem usa: as rotas de `oficinas/api.py`. O frontend espelha estes formatos em
`frontend/src/lib/api.ts`, então mudar um campo aqui quebra a tela.
"""
from datetime import datetime
from typing import Literal

from ninja import Field, Schema

from oficinas.models import Documento

# Mesmos valores das escolhas em `Avaliacao.VEREDITOS` e `Avaliacao.PREFERENCIAS`.
Veredito = Literal["correta", "parcial", "errada", "nao_sei"]
Preferencia = Literal["primeira", "segunda", "nenhuma"]


# ---------------------------------------------------------------- perguntas e respostas


class PerguntaIn(Schema):
    texto: str = Field(min_length=5, max_length=300)
    referencia: str = Field(default="", max_length=3000)


class PerguntaOut(Schema):
    id: int
    ordem: int
    texto: str


class PerguntaFacilitadorOut(PerguntaOut):
    """Só o facilitador vê a referência; o participante a recebe depois de avaliar."""

    referencia: str


class PerguntarIn(Schema):
    pergunta_id: int
    tentativa: Literal[1, 2]  # 1 = sem contexto, 2 = com fontes


class TrechoOut(Schema):
    documento: str
    pagina: int
    similaridade: float
    texto: str


class TrechoNaBuscaOut(TrechoOut):
    ordem: int  # posição do trecho na base do participante (0 = primeiro)
    situacao: Literal["usado", "fora_do_limite", "abaixo_do_minimo"]


class BuscaOut(Schema):
    total: int  # trechos na base; a lista traz só os mais parecidos, até o limite da rota
    top_k: int
    limiar: float
    mudou_desde_a_resposta: bool  # a base mudou e a busca de agora não bate com a resposta salva
    trechos: list[TrechoNaBuscaOut]


class RespostaOut(Schema):
    id: int
    pergunta_id: int
    tentativa: int
    texto: str
    trechos: list[TrechoOut]
    nada_relevante: bool
    instrucoes_enviadas: str
    tempo_segundos: float
    criado_em: datetime


# ---------------------------------------------------------------- fontes (documentos)


class TextoIn(Schema):
    titulo: str = Field(min_length=1, max_length=160)
    texto: str = Field(min_length=20, max_length=20_000)


class DocumentoOut(Schema):
    id: int
    nome: str
    origem: str
    paginas: int
    trechos: int
    copia_de_id: int | None
    criado_em: datetime

    @staticmethod
    def resolve_trechos(obj: Documento) -> int:
        return obj.trechos.count()


# ---------------------------------------------------------------- avaliação


class AvaliacaoIn(Schema):
    primeira: Veredito
    segunda: Veredito
    mais_confiavel: Preferencia
    conferiu_fonte: bool = False
    observacao: str = Field(default="", max_length=600)


class AvaliacaoOut(AvaliacaoIn):
    pergunta_id: int


# ---------------------------------------------------------------- participante


class EntrarIn(Schema):
    apelido: str = Field(min_length=1, max_length=40)
    consentimento: bool


class OrientacaoIn(Schema):
    orientacao: str = Field(max_length=800)


class OficinaResumoOut(Schema):
    titulo: str
    codigo: str
    aberta: bool


class EstadoOut(Schema):
    """Tudo que a tela do participante precisa, numa chamada só."""

    id: int
    apelido: str
    orientacao: str
    oficina: OficinaResumoOut
    perguntas: list[PerguntaOut]
    fontes_sugeridas: list[DocumentoOut]
    documentos: list[DocumentoOut]
    respostas: list[RespostaOut]
    avaliacoes: list[AvaliacaoOut]
    referencias: dict[int, str]


class EntrarOut(Schema):
    token: str
    estado: EstadoOut


# ---------------------------------------------------------------- facilitador


class SenhaIn(Schema):
    senha: str = Field(min_length=1, max_length=200)


class NovaOficinaIn(Schema):
    titulo: str = Field(min_length=3, max_length=120)
    perguntas: list[PerguntaIn] = Field(min_length=3, max_length=3)


class AtualizarOficinaIn(Schema):
    """Todos os campos são opcionais: só muda o que vier no pedido."""

    titulo: str | None = Field(default=None, min_length=3, max_length=120)
    aberta: bool | None = None
    perguntas: list[PerguntaIn] | None = Field(default=None, min_length=3, max_length=3)


class OficinaOut(Schema):
    id: int
    titulo: str
    codigo: str
    aberta: bool
    criado_em: datetime
    total_participantes: int


class PerguntaDoRelatorioOut(Schema):
    pergunta_id: int
    primeira: RespostaOut | None
    segunda: RespostaOut | None
    avaliacao: AvaliacaoOut | None


class ParticipanteDoRelatorioOut(Schema):
    id: int
    apelido: str
    criado_em: datetime
    fontes: list[str]
    orientacao: str
    perguntas: list[PerguntaDoRelatorioOut]


class OficinaDetalheOut(OficinaOut):
    perguntas: list[PerguntaFacilitadorOut]
    fontes: list[DocumentoOut]
    relatorio: list[ParticipanteDoRelatorioOut]
