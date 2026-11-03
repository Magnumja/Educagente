import csv
import io
from datetime import datetime
from typing import Literal

from django.db.models import Count
from django.http import HttpResponse
from django.utils import timezone
from django.utils.http import content_disposition_header
from ninja import Field, File, Router, Schema, UploadedFile
from ninja.security import APIKeyHeader, HttpBearer
from ninja.throttling import AnonRateThrottle, AuthRateThrottle

from oficinas import services
from oficinas.models import Avaliacao, Documento, Oficina, Participante, Resposta


class TokenDoParticipante(APIKeyHeader):
    param_name = "X-Participante"

    def authenticate(self, request, key):
        return services.participante_por_token(key or "")


class TokenDoFacilitador(HttpBearer):
    def authenticate(self, request, token):
        return services.token_de_facilitador_valido(token) or None


publico = Router(tags=["público"])
participante = Router(tags=["participante"], auth=TokenDoParticipante())
facilitador = Router(tags=["facilitador"], auth=TokenDoFacilitador())

Veredito = Literal["correta", "parcial", "errada", "nao_sei"]
Preferencia = Literal["primeira", "segunda", "nenhuma"]


# ---------------------------------------------------------------- schemas


class PerguntaIn(Schema):
    texto: str = Field(min_length=5, max_length=300)
    referencia: str = Field(default="", max_length=3000)


class PerguntaOut(Schema):
    id: int
    ordem: int
    texto: str


class PerguntaFacilitadorOut(PerguntaOut):
    referencia: str


class TrechoOut(Schema):
    documento: str
    pagina: int
    similaridade: float
    texto: str


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


class AvaliacaoIn(Schema):
    primeira: Veredito
    segunda: Veredito
    mais_confiavel: Preferencia
    conferiu_fonte: bool = False
    observacao: str = Field(default="", max_length=600)


class AvaliacaoOut(AvaliacaoIn):
    pergunta_id: int


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


class EntrarIn(Schema):
    apelido: str = Field(min_length=1, max_length=40)
    consentimento: bool


class EntrarOut(Schema):
    token: str
    estado: EstadoOut


class PerguntarIn(Schema):
    pergunta_id: int
    tentativa: Literal[1, 2]


class TextoIn(Schema):
    titulo: str = Field(min_length=1, max_length=160)
    texto: str = Field(min_length=20, max_length=20_000)


class OrientacaoIn(Schema):
    orientacao: str = Field(max_length=800)


class SenhaIn(Schema):
    senha: str = Field(min_length=1, max_length=200)


class NovaOficinaIn(Schema):
    titulo: str = Field(min_length=3, max_length=120)
    perguntas: list[PerguntaIn] = Field(min_length=3, max_length=3)


class AtualizarOficinaIn(Schema):
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


# ---------------------------------------------------------------- helpers


def estado(p: Participante) -> dict:
    perguntas = list(p.oficina.perguntas.all())
    avaliadas = set(p.avaliacoes.values_list("pergunta_id", flat=True))
    return {
        "id": p.pk,
        "apelido": p.apelido,
        "orientacao": p.orientacao,
        "oficina": p.oficina,
        "perguntas": perguntas,
        "fontes_sugeridas": list(p.oficina.fontes.all()),
        "documentos": list(p.documentos.all()),
        "respostas": list(p.respostas.all()),
        "avaliacoes": list(p.avaliacoes.all()),
        # A referência do facilitador só aparece depois que o participante avaliou sozinho.
        "referencias": {q.pk: q.referencia for q in perguntas if q.pk in avaliadas and q.referencia},
    }


def detalhe(oficina: Oficina) -> dict:
    rel = services.relatorio(oficina)
    return {
        "id": oficina.pk,
        "titulo": oficina.titulo,
        "codigo": oficina.codigo,
        "aberta": oficina.aberta,
        "criado_em": oficina.criado_em,
        "total_participantes": len(rel["participantes"]),
        "perguntas": rel["perguntas"],
        "fontes": list(oficina.fontes.all()),
        "relatorio": rel["participantes"],
    }


def celula(valor) -> str:
    """Neutraliza fórmulas: o CSV é aberto no Excel, e o texto vem dos participantes e da IA."""
    texto = "" if valor is None else str(valor)
    return "'" + texto if texto[:1] in ("=", "+", "-", "@", chr(9), chr(13)) else texto


def ler_upload(arquivo: UploadedFile) -> bytes:
    if (arquivo.size or 0) > services.MAX_BYTES_ARQUIVO:
        raise services.EntradaInvalida("O arquivo passa de 5 MB. Envie uma versão menor.")
    return arquivo.read()


# ---------------------------------------------------------------- público


@publico.get("/oficinas/{codigo}", response=OficinaResumoOut)
def ver_oficina(request, codigo: str):
    return services.oficina_por_codigo(codigo)


@publico.post("/oficinas/{codigo}/entrar", response=EntrarOut, throttle=[AnonRateThrottle("120/m")])
def entrar(request, codigo: str, dados: EntrarIn):
    p, token = services.entrar(codigo, dados.apelido, dados.consentimento)
    return {"token": token, "estado": estado(p)}


@publico.post("/facilitador/entrar", throttle=[AnonRateThrottle("5/m")])
def entrar_facilitador(request, dados: SenhaIn):
    return {"token": services.entrar_como_facilitador(dados.senha)}


# ---------------------------------------------------------------- participante


@participante.get("/eu", response=EstadoOut)
def ver_estado(request):
    return estado(request.auth)


@participante.delete("/eu", response={204: None})
def sair_e_apagar(request):
    """LGPD: o participante apaga tudo o que enviou e respondeu."""
    request.auth.delete()
    return 204, None


@participante.post("/eu/perguntar", response=RespostaOut, throttle=[AuthRateThrottle("15/m")])
def perguntar(request, dados: PerguntarIn):
    return services.perguntar(request.auth, dados.pergunta_id, dados.tentativa)


@participante.post("/eu/documentos", response=DocumentoOut, throttle=[AuthRateThrottle("10/m")])
def enviar_documento(request, arquivo: UploadedFile = File(...)):
    return services.adicionar_arquivo(request.auth, arquivo.name or "", ler_upload(arquivo))


@participante.post("/eu/textos", response=DocumentoOut, throttle=[AuthRateThrottle("10/m")])
def colar_texto(request, dados: TextoIn):
    return services.adicionar_texto(request.auth, dados.titulo, dados.texto)


@participante.post("/eu/fontes-sugeridas/{fonte_id}", response=DocumentoOut)
def usar_fonte_sugerida(request, fonte_id: int):
    return services.adicionar_fonte_sugerida(request.auth, fonte_id)


@participante.delete("/eu/documentos/{documento_id}", response={204: None})
def remover_documento(request, documento_id: int):
    services.remover_documento(request.auth, documento_id)
    return 204, None


@participante.put("/eu/orientacao", response={204: None})
def salvar_orientacao(request, dados: OrientacaoIn):
    services.salvar_orientacao(request.auth, dados.orientacao)
    return 204, None


@participante.put("/eu/avaliacoes/{pergunta_id}", response=AvaliacaoOut)
def avaliar(request, pergunta_id: int, dados: AvaliacaoIn):
    return services.avaliar(request.auth, pergunta_id, dados.dict() | {"atualizado_em": timezone.now()})


# ---------------------------------------------------------------- facilitador


@facilitador.get("/facilitador/oficinas", response=list[OficinaOut])
def listar_oficinas(request):
    return list(Oficina.objects.annotate(total_participantes=Count("participantes")))


@facilitador.post("/facilitador/oficinas", response=OficinaDetalheOut)
def criar_oficina(request, dados: NovaOficinaIn):
    oficina = services.criar_oficina(dados.titulo, [p.dict() for p in dados.perguntas])
    return detalhe(oficina)


@facilitador.get("/facilitador/oficinas/{oficina_id}", response=OficinaDetalheOut)
def ver_oficina_facilitador(request, oficina_id: int):
    return detalhe(services.buscar_oficina(oficina_id))


@facilitador.patch("/facilitador/oficinas/{oficina_id}", response=OficinaDetalheOut)
def atualizar_oficina(request, oficina_id: int, dados: AtualizarOficinaIn):
    oficina = services.buscar_oficina(oficina_id)
    perguntas = [p.dict() for p in dados.perguntas] if dados.perguntas is not None else None
    services.atualizar_oficina(oficina, dados.titulo, dados.aberta, perguntas)
    return detalhe(oficina)


@facilitador.delete("/facilitador/oficinas/{oficina_id}", response={204: None})
def apagar_oficina(request, oficina_id: int):
    services.buscar_oficina(oficina_id).delete()
    return 204, None


@facilitador.post("/facilitador/oficinas/{oficina_id}/fontes", response=DocumentoOut)
def enviar_fonte(request, oficina_id: int, arquivo: UploadedFile = File(...)):
    oficina = services.buscar_oficina(oficina_id)
    return services.adicionar_fonte_da_oficina(oficina, arquivo.name or "", ler_upload(arquivo))


@facilitador.delete("/facilitador/oficinas/{oficina_id}/fontes/{fonte_id}", response={204: None})
def remover_fonte(request, oficina_id: int, fonte_id: int):
    services.remover_fonte_da_oficina(services.buscar_oficina(oficina_id), fonte_id)
    return 204, None


@facilitador.delete("/facilitador/oficinas/{oficina_id}/participantes/{participante_id}", response={204: None})
def apagar_participante(request, oficina_id: int, participante_id: int):
    services.apagar_participante(services.buscar_oficina(oficina_id), participante_id)
    return 204, None


@facilitador.get("/facilitador/oficinas/{oficina_id}/export.csv")
def exportar_csv(request, oficina_id: int):
    oficina = services.buscar_oficina(oficina_id)
    rel = services.relatorio(oficina)
    textos = {q.pk: q.texto for q in rel["perguntas"]}
    buffer = io.StringIO()
    escritor = csv.writer(buffer)
    escritor.writerow([
        "participante_id", "apelido", "pergunta", "resposta_sem_contexto", "resposta_com_fontes",
        "fontes_citadas", "nada_relevante", "avaliou_primeira", "avaliou_segunda", "mais_confiavel",
        "conferiu_fonte", "observacao", "orientacao_dada", "fontes_na_base",
    ])
    for linha in rel["participantes"]:
        for item in linha["perguntas"]:
            r1: Resposta | None = item["primeira"]
            r2: Resposta | None = item["segunda"]
            av: Avaliacao | None = item["avaliacao"]
            citadas = "; ".join(f"{t['documento']} p.{t['pagina']}" for t in (r2.trechos if r2 else []))
            escritor.writerow(celula(v) for v in [
                linha["id"], linha["apelido"], textos[item["pergunta_id"]],
                r1.texto if r1 else "", r2.texto if r2 else "", citadas,
                "sim" if r2 and r2.nada_relevante else "",
                av.primeira if av else "", av.segunda if av else "", av.mais_confiavel if av else "",
                ("sim" if av.conferiu_fonte else "não") if av else "", av.observacao if av else "",
                linha["orientacao"], "; ".join(linha["fontes"]),
            ])
    return HttpResponse(
        "﻿" + buffer.getvalue(),  # BOM: o Excel abre com acentos corretos
        content_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": content_disposition_header(True, f"oficina-{oficina.codigo}.csv")},
    )
