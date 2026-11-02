import csv
import io

from django.http import HttpResponse
from ninja import Field, File, Form, Router, Schema, UploadedFile

from oficina import services
from oficina.models import Resposta

router = Router(tags=["oficina"])


class NovoAluno(Schema):
    apelido: str = Field(min_length=1, max_length=40)
    turma: str | None = Field(default=None, max_length=40)
    consentimento: bool


class Pergunta(Schema):
    etapa: int = Field(ge=1, le=3)
    pergunta: str = Field(min_length=1, max_length=1000)


def resposta_para_dict(resposta: Resposta) -> dict:
    return {
        "id": resposta.pk,
        "aluno_id": resposta.aluno_id,
        "apelido": resposta.aluno.apelido,
        "turma": resposta.aluno.turma,
        "etapa": resposta.etapa,
        "pergunta": resposta.pergunta,
        "resposta": resposta.resposta,
        "trechos": resposta.trechos,
        "criado_em": resposta.criado_em,
    }


@router.post("/alunos")
def criar_aluno(request, dados: NovoAluno):
    aluno = services.criar_aluno(dados.apelido, dados.turma, dados.consentimento)
    return {"id": aluno.pk, "apelido": aluno.apelido, "turma": aluno.turma}


@router.get("/alunos/{aluno_id}")
def ver_aluno(request, aluno_id: int):
    aluno = services.buscar_aluno(aluno_id)
    return {
        "id": aluno.pk,
        "apelido": aluno.apelido,
        "turma": aluno.turma,
        "consentimento": aluno.consentimento,
        "criado_em": aluno.criado_em,
        "trechos": services.contar_trechos(aluno),
    }


@router.post("/alunos/{aluno_id}/documentos")
def enviar_documento(request, aluno_id: int, etapa: int = Form(...), arquivo: UploadedFile = File(...)):
    aluno = services.buscar_aluno(aluno_id)
    trechos = services.enviar_documento(aluno, etapa, arquivo.name or "", arquivo.read())
    return {"trechos": len(trechos), "exemplos": trechos[:3]}


@router.post("/alunos/{aluno_id}/perguntar")
def perguntar(request, aluno_id: int, dados: Pergunta):
    aluno = services.buscar_aluno(aluno_id)
    resposta, resultado = services.perguntar(aluno, dados.etapa, dados.pergunta)
    return {
        "id": resposta.pk,
        "etapa": resposta.etapa,
        "pergunta": resposta.pergunta,
        "resposta": resposta.resposta,
        "trechos": resposta.trechos,
        "tempo_segundos": resultado.time_seconds,
        "nada_relevante": resultado.no_relevant_knowledge,
    }


@router.get("/alunos/{aluno_id}/respostas")
def respostas_do_aluno(request, aluno_id: int):
    aluno = services.buscar_aluno(aluno_id)
    return [resposta_para_dict(r) for r in aluno.respostas.select_related("aluno")]


@router.get("/alunos/{aluno_id}/comparacao")
def comparacao(request, aluno_id: int):
    aluno = services.buscar_aluno(aluno_id)
    grupos: dict[str, dict] = {}
    for resposta in aluno.respostas.select_related("aluno"):
        grupo = grupos.setdefault(
            services.chave_da_pergunta(resposta.pergunta), {"pergunta": resposta.pergunta, "etapas": {}}
        )
        grupo["etapas"][resposta.etapa] = resposta_para_dict(resposta)  # a mais recente de cada etapa vence
    return sorted(grupos.values(), key=lambda grupo: -len(grupo["etapas"]))


@router.get("/professor/respostas")
def todas_respostas(request):
    return [resposta_para_dict(r) for r in Resposta.objects.select_related("aluno")]


@router.get("/professor/export.csv")
def exportar_csv(request):
    buffer = io.StringIO()
    escritor = csv.writer(buffer)
    escritor.writerow(["id", "aluno_id", "apelido", "turma", "etapa", "pergunta", "resposta", "trechos", "criado_em"])
    for r in Resposta.objects.select_related("aluno"):
        escritor.writerow([
            r.pk, r.aluno_id, r.aluno.apelido, r.aluno.turma, r.etapa, r.pergunta, r.resposta,
            " | ".join(t["texto"] for t in r.trechos), r.criado_em.isoformat(timespec="seconds"),
        ])
    return HttpResponse(
        "﻿" + buffer.getvalue(),  # BOM: o Excel abre com acentos corretos
        content_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=respostas-oficina.csv"},
    )
