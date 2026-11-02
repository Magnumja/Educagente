"""Backend da oficina RAG: recebe documentos (PDF/TXT), indexa no núcleo próprio e responde
perguntas.

Etapa 1 = LLM sem RAG. Etapa 2 = RAG com documento "errado". Etapa 3 = RAG com documento real.

O modelo "Projeto" (criar projeto, prompt de 5 campos, Conversar/Comparar/Exportar) vive em
`projetos.py`, montado abaixo como router — reaproveita o mesmo núcleo (`core/`) e o mesmo
banco (`db.py`).
"""

import csv
import io
import json
import os
from contextlib import closing
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import projetos
from config import CORS_ORIGINS, DATA, EMBEDDING_MODEL, MODEL, MODEL_PROVIDER, SIMILARITY_THRESHOLD, TOP_K
from core.chunking import chunk_text
from core.engine import run as engine_run
from core.ingestion import extrair_paginas
from core.schema import PromptConfig, ProjectConfig, RetrievalConfig
from core.store import ProjectIndex
from db import agora, db, get_aluno

SYSTEM_LIVRE = (
    "Você é um assistente conversando com estudantes do Ensino Médio. Responda em português, "
    "de forma curta e direta."
)
SYSTEM_RAG_INSTRUCAO = (
    "Você é um assistente conversando com estudantes do Ensino Médio. Responda em português, "
    "de forma curta e direta, usando SOMENTE as informações dos trechos da base de "
    "conhecimento abaixo. Cite o número do trecho entre colchetes, por exemplo [1]. "
    "Se os trechos não tiverem a resposta, diga que não encontrou nos dados."
)


# ---------- RAG (Oficina — 3 etapas fixas) ----------

def caminho_indice(aluno_id: int, etapa: int) -> Path:
    return DATA / "indices" / f"aluno{aluno_id}_etapa{etapa}.jsonl"


def obter_indice(aluno_id: int, etapa: int) -> ProjectIndex:
    indice = ProjectIndex(caminho_indice(aluno_id, etapa), embedding_model=EMBEDDING_MODEL)
    indice.load()
    return indice


def contar_trechos(aluno_id: int, etapa: int) -> int:
    return obter_indice(aluno_id, etapa).count()


# ---------- API ----------

app = FastAPI(title="Educagente")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(projetos.router)


class NovoAluno(BaseModel):
    apelido: str = Field(min_length=1, max_length=40)
    turma: str | None = Field(default=None, max_length=40)
    consentimento: bool


class Pergunta(BaseModel):
    etapa: int = Field(ge=1, le=3)
    pergunta: str = Field(min_length=1, max_length=1000)


@app.get("/api/saude")
def saude():
    # Mesma regra de build_adapter: provedor com chave e sem chave no .env cai no DemoAdapter.
    chave_do_provedor = {"anthropic": "ANTHROPIC_API_KEY", "openai": "OPENAI_API_KEY"}.get(MODEL_PROVIDER)
    modo_demonstracao = MODEL_PROVIDER == "demo" or (
        chave_do_provedor is not None and not os.getenv(chave_do_provedor)
    )
    return {
        "ok": True,
        "provedor": MODEL_PROVIDER,
        "modelo": MODEL,
        "llm_configurada": not modo_demonstracao,
    }


class ValidarChave(BaseModel):
    provider: str = Field(pattern="^(anthropic|openai)$")
    api_key: str = Field(min_length=1, max_length=400)


@app.post("/api/validar-chave")
def validar_chave(body: ValidarChave):
    """Testa a chave do aluno com uma chamada mínima (lista de modelos, sem gastar
    tokens de conversa) e a descarta — nunca fica guardada no servidor."""
    try:
        if body.provider == "anthropic":
            import anthropic

            anthropic.Anthropic(api_key=body.api_key).models.list(limit=1)
        else:
            import openai

            openai.OpenAI(api_key=body.api_key).models.list()
    except Exception as e:
        return {"ok": False, "erro": str(e)}
    return {"ok": True}


@app.post("/api/alunos")
def criar_aluno(body: NovoAluno):
    if not body.consentimento:
        raise HTTPException(400, "É preciso aceitar o termo de consentimento.")
    apelido = body.apelido.strip()
    turma = (body.turma or "").strip() or None
    with closing(db()) as conn:
        cur = conn.execute(
            "INSERT INTO alunos (apelido, turma, consentimento, criado_em) VALUES (?, ?, 1, ?)",
            (apelido, turma, agora()),
        )
        conn.commit()
    return {"id": cur.lastrowid, "apelido": apelido, "turma": turma}


@app.get("/api/alunos/{aluno_id}")
def ver_aluno(aluno_id: int):
    aluno = dict(get_aluno(aluno_id))
    aluno["trechos"] = {etapa: contar_trechos(aluno_id, etapa) for etapa in (2, 3)}
    return aluno


@app.post("/api/alunos/{aluno_id}/documentos")
async def enviar_documento(aluno_id: int, etapa: int = Form(...), arquivo: UploadFile = File(...)):
    get_aluno(aluno_id)
    if etapa not in (2, 3):
        raise HTTPException(400, "Etapa inválida (use 2 ou 3).")

    sufixo = Path(arquivo.filename or "").suffix.lower()
    if sufixo not in (".pdf", ".txt"):
        raise HTTPException(400, "Envie um arquivo PDF ou TXT.")

    pasta_uploads = DATA / "uploads"
    pasta_uploads.mkdir(parents=True, exist_ok=True)
    caminho = pasta_uploads / f"aluno{aluno_id}_etapa{etapa}{sufixo}"
    caminho.write_bytes(await arquivo.read())

    paginas = extrair_paginas(caminho)
    trechos_por_pagina = [
        (pagina.pagina, trecho)
        for pagina in paginas
        for trecho in chunk_text(pagina.texto)
        if trecho.strip()
    ]
    if not trechos_por_pagina:
        raise HTTPException(400, "Não foi possível extrair texto do arquivo enviado.")

    indice = obter_indice(aluno_id, etapa)
    total = indice.add_document_chunks(
        doc_id="documento", documento=arquivo.filename or sufixo, paginas_trechos=trechos_por_pagina
    )
    return {"trechos": total, "exemplos": [texto for _, texto in trechos_por_pagina[:3]]}


@app.post("/api/alunos/{aluno_id}/perguntar")
def perguntar(aluno_id: int, body: Pergunta):
    get_aluno(aluno_id)
    use_rag = body.etapa != 1

    indice = None
    if use_rag:
        indice = obter_indice(aluno_id, body.etapa)
        if indice.count() == 0:
            raise HTTPException(400, f"Envie o documento da etapa {body.etapa} antes de perguntar.")

    config = ProjectConfig(
        project_id=f"aluno{aluno_id}",
        model_provider=MODEL_PROVIDER,
        model_name=MODEL,
        embedding_model=EMBEDDING_MODEL,
        prompt=PromptConfig(persona=SYSTEM_LIVRE if body.etapa == 1 else SYSTEM_RAG_INSTRUCAO),
        retrieval=RetrievalConfig(top_k=TOP_K, similarity_threshold=SIMILARITY_THRESHOLD),
    )

    try:
        resultado = engine_run(config, indice, body.pergunta, use_prompt=True, use_rag=use_rag)
    except Exception as e:
        raise HTTPException(502, f"Falha ao chamar a LLM: {e}")

    trechos = [
        {"texto": c.texto, "documento": c.documento, "pagina": c.pagina, "similaridade": c.similaridade}
        for c in resultado.used_chunks
    ]
    pergunta = body.pergunta.strip()
    with closing(db()) as conn:
        cur = conn.execute(
            "INSERT INTO respostas (aluno_id, etapa, pergunta, resposta, trechos, criado_em) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (aluno_id, body.etapa, pergunta, resultado.answer, json.dumps(trechos, ensure_ascii=False), agora()),
        )
        conn.commit()
    return {
        "id": cur.lastrowid,
        "etapa": body.etapa,
        "pergunta": pergunta,
        "resposta": resultado.answer,
        "trechos": trechos,
        "tempo_segundos": resultado.time_seconds,
        "nada_relevante": resultado.no_relevant_knowledge,
    }


def linhas_respostas(where: str = "", params: tuple = ()) -> list[dict]:
    with closing(db()) as conn:
        rows = conn.execute(
            "SELECT r.*, a.apelido, a.turma FROM respostas r JOIN alunos a ON a.id = r.aluno_id "
            f"{where} ORDER BY r.id",
            params,
        ).fetchall()
    return [{**dict(r), "trechos": json.loads(r["trechos"])} for r in rows]


@app.get("/api/alunos/{aluno_id}/respostas")
def respostas_do_aluno(aluno_id: int):
    get_aluno(aluno_id)
    return linhas_respostas("WHERE r.aluno_id = ?", (aluno_id,))


@app.get("/api/alunos/{aluno_id}/comparacao")
def comparacao(aluno_id: int):
    """Agrupa as respostas pela mesma pergunta (ignorando maiúsculas, espaços e pontuação final)."""
    grupos: dict[str, dict] = {}
    for r in respostas_do_aluno(aluno_id):
        chave = " ".join(r["pergunta"].lower().split()).rstrip("?!. ")
        g = grupos.setdefault(chave, {"pergunta": r["pergunta"], "etapas": {}})
        g["etapas"][r["etapa"]] = r  # a mais recente de cada etapa vence
    return sorted(grupos.values(), key=lambda g: -len(g["etapas"]))


@app.get("/api/professor/respostas")
def todas_respostas():
    return linhas_respostas()


@app.get("/api/professor/export.csv")
def exportar_csv():
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "aluno_id", "apelido", "turma", "etapa", "pergunta", "resposta", "trechos", "criado_em"])
    for r in linhas_respostas():
        w.writerow([r["id"], r["aluno_id"], r["apelido"], r["turma"], r["etapa"], r["pergunta"],
                    r["resposta"], " | ".join(t["texto"] for t in r["trechos"]), r["criado_em"]])
    return StreamingResponse(
        iter(["﻿" + buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=respostas-oficina.csv"},
    )
