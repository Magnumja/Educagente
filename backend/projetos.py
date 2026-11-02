"""Router do modelo "Projeto": o aluno cria até 3 projetos, configura um prompt de 5
campos, sobe seus documentos, conversa com o agente completo e compara lado a lado
modelo puro vs. +prompt vs. +prompt+RAG.

Reaproveita o núcleo (`core/`) tal como está — a única mudança no contrato
`engine.run(config, index, question, use_prompt, use_rag, api_key=None) -> EngineResult`
foi o parâmetro `api_key` aditivo, pra suportar BYOK (ver core/engine.py).
"""
from __future__ import annotations

import json
from contextlib import closing
from pathlib import Path

from fastapi import APIRouter, File, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from config import DATA, EMBEDDING_MODEL
from core.chunking import chunk_text
from core.engine import run as engine_run
from core.export import build_export_zip
from core.ingestion import extrair_paginas
from core.prompt_builder import build_prompt
from core.schema import PromptConfig, ProjectConfig, RetrievalConfig
from core.store import ProjectIndex
from db import agora, db, get_aluno

LIMITE_PROJETOS = 3

# BYOK: um modelo fixo por provedor (evita o aluno digitar um nome de modelo
# inválido). "ollama" não precisa de chave — usa o servidor local da turma.
MODELOS_POR_PROVEDOR = {
    "anthropic": "claude-haiku-5-5",
    "openai": "gpt-4o-mini",
    "ollama": "llama3.2:1b",
}

router = APIRouter(prefix="/api/alunos/{aluno_id}/projetos", tags=["projetos"])


class NovoProjeto(BaseModel):
    nome: str = Field(min_length=1, max_length=80)
    descricao: str | None = Field(default=None, max_length=500)
    model_provider: str = Field(default="ollama")
    cenario_id: str | None = None


class AtualizarProjeto(BaseModel):
    prompt_persona: str | None = Field(default=None, max_length=2000)
    prompt_context: str | None = Field(default=None, max_length=2000)
    prompt_instruction: str | None = Field(default=None, max_length=2000)
    prompt_restriction: str | None = Field(default=None, max_length=2000)
    prompt_output_format: str | None = Field(default=None, max_length=2000)
    chunk_max_chars: int | None = Field(default=None, ge=100, le=4000)
    chunk_overlap_chars: int | None = Field(default=None, ge=0, le=1000)
    top_k: int | None = Field(default=None, ge=1, le=20)
    similarity_threshold: float | None = Field(default=None, ge=0, le=1)


class PerguntaProjeto(BaseModel):
    pergunta: str = Field(min_length=1, max_length=1000)


# ---------- helpers ----------

def pasta_projeto(projeto_id: int) -> Path:
    return DATA / "projetos" / str(projeto_id)


def caminho_indice(projeto_id: int) -> Path:
    return pasta_projeto(projeto_id) / "index.jsonl"


def pasta_uploads(projeto_id: int) -> Path:
    return pasta_projeto(projeto_id) / "uploads"


def get_projeto(aluno_id: int, projeto_id: int) -> dict:
    with closing(db()) as conn:
        row = conn.execute(
            "SELECT * FROM projetos WHERE id = ? AND aluno_id = ?", (projeto_id, aluno_id)
        ).fetchone()
    if not row:
        raise HTTPException(404, "Projeto não encontrado")
    return dict(row)


def projeto_para_config(p: dict) -> ProjectConfig:
    return ProjectConfig(
        project_id=str(p["id"]),
        model_provider=p["model_provider"],
        model_name=p["model_name"],
        embedding_model=p["embedding_model"],
        prompt=PromptConfig(
            persona=p["prompt_persona"],
            context=p["prompt_context"],
            instruction=p["prompt_instruction"],
            restriction=p["prompt_restriction"],
            output_format=p["prompt_output_format"],
        ),
        retrieval=RetrievalConfig(
            chunk_max_chars=p["chunk_max_chars"],
            chunk_overlap_chars=p["chunk_overlap_chars"],
            top_k=p["top_k"],
            similarity_threshold=p["similarity_threshold"],
        ),
    )


def obter_indice(projeto_id: int, config: ProjectConfig) -> ProjectIndex:
    indice = ProjectIndex(caminho_indice(projeto_id), embedding_model=config.embedding_model)
    indice.load()
    return indice


def salvar_resposta(projeto_id: int, pergunta: str, modo: str, resultado) -> int:
    trechos = [
        {"texto": c.texto, "documento": c.documento, "pagina": c.pagina, "similaridade": c.similaridade}
        for c in resultado.used_chunks
    ]
    with closing(db()) as conn:
        cur = conn.execute(
            "INSERT INTO projeto_respostas (projeto_id, pergunta, modo, resposta, trechos_json, "
            "tempo_segundos, tokens_in, tokens_out, nada_relevante, criado_em) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                projeto_id, pergunta, modo, resultado.answer, json.dumps(trechos, ensure_ascii=False),
                resultado.time_seconds, resultado.tokens_in, resultado.tokens_out,
                int(resultado.no_relevant_knowledge), agora(),
            ),
        )
        conn.commit()
    return cur.lastrowid


def resultado_para_json(resultado, resposta_id: int, modo: str) -> dict:
    return {
        "id": resposta_id,
        "modo": modo,
        "resposta": resultado.answer,
        "trechos": [
            {"texto": c.texto, "documento": c.documento, "pagina": c.pagina, "similaridade": c.similaridade}
            for c in resultado.used_chunks
        ],
        "tempo_segundos": resultado.time_seconds,
        "tokens_in": resultado.tokens_in,
        "tokens_out": resultado.tokens_out,
        "nada_relevante": resultado.no_relevant_knowledge,
    }


# ---------- endpoints ----------

@router.post("")
def criar_projeto(aluno_id: int, body: NovoProjeto):
    get_aluno(aluno_id)
    if body.model_provider not in MODELOS_POR_PROVEDOR:
        raise HTTPException(400, f"Provedor inválido. Use um de: {', '.join(MODELOS_POR_PROVEDOR)}.")
    model_name = MODELOS_POR_PROVEDOR[body.model_provider]
    with closing(db()) as conn:
        total = conn.execute("SELECT COUNT(*) AS n FROM projetos WHERE aluno_id = ?", (aluno_id,)).fetchone()["n"]
        if total >= LIMITE_PROJETOS:
            raise HTTPException(400, f"Limite de {LIMITE_PROJETOS} projetos por aluno atingido.")
        agora_str = agora()
        cur = conn.execute(
            "INSERT INTO projetos (aluno_id, nome, descricao, cenario_id, model_provider, model_name, "
            "embedding_model, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (aluno_id, body.nome.strip(), body.descricao, body.cenario_id, body.model_provider, model_name,
             EMBEDDING_MODEL, agora_str, agora_str),
        )
        conn.commit()
    return get_projeto(aluno_id, cur.lastrowid)


@router.get("")
def listar_projetos(aluno_id: int):
    get_aluno(aluno_id)
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM projetos WHERE aluno_id = ? ORDER BY id", (aluno_id,)).fetchall()
    return [dict(r) for r in rows]


@router.get("/{projeto_id}")
def ver_projeto(aluno_id: int, projeto_id: int):
    get_aluno(aluno_id)
    projeto = get_projeto(aluno_id, projeto_id)
    with closing(db()) as conn:
        docs = conn.execute(
            "SELECT * FROM projeto_documentos WHERE projeto_id = ? ORDER BY id", (projeto_id,)
        ).fetchall()
    projeto["documentos"] = [dict(d) for d in docs]
    return projeto


@router.patch("/{projeto_id}")
def atualizar_projeto(aluno_id: int, projeto_id: int, body: AtualizarProjeto):
    get_aluno(aluno_id)
    get_projeto(aluno_id, projeto_id)
    campos = body.model_dump(exclude_none=True)
    if not campos:
        return get_projeto(aluno_id, projeto_id)
    sets = ", ".join(f"{campo} = ?" for campo in campos)
    with closing(db()) as conn:
        conn.execute(
            f"UPDATE projetos SET {sets}, atualizado_em = ? WHERE id = ?",
            (*campos.values(), agora(), projeto_id),
        )
        conn.commit()
    return get_projeto(aluno_id, projeto_id)


@router.post("/{projeto_id}/documentos")
async def enviar_documento_projeto(aluno_id: int, projeto_id: int, arquivo: UploadFile = File(...)):
    get_aluno(aluno_id)
    projeto = get_projeto(aluno_id, projeto_id)

    sufixo = Path(arquivo.filename or "").suffix.lower()
    if sufixo not in (".pdf", ".txt"):
        raise HTTPException(400, "Envie um arquivo PDF ou TXT.")

    pasta = pasta_uploads(projeto_id)
    pasta.mkdir(parents=True, exist_ok=True)
    # Só o nome final do arquivo: o filename vem do cliente e pode trazer "../" ou caminho absoluto.
    nome_seguro = Path(arquivo.filename or "").name or f"documento{sufixo}"
    caminho = pasta / nome_seguro
    caminho.write_bytes(await arquivo.read())

    paginas = extrair_paginas(caminho)
    config = projeto_para_config(projeto)
    trechos_por_pagina = [
        (pagina.pagina, trecho)
        for pagina in paginas
        for trecho in chunk_text(pagina.texto, config.retrieval.chunk_max_chars, config.retrieval.chunk_overlap_chars)
        if trecho.strip()
    ]
    status = "pronto" if trechos_por_pagina else "sem_texto_extraido"

    if trechos_por_pagina:
        indice = obter_indice(projeto_id, config)
        indice.add_document_chunks(doc_id=caminho.name, documento=arquivo.filename or sufixo, paginas_trechos=trechos_por_pagina)

    with closing(db()) as conn:
        cur = conn.execute(
            "INSERT INTO projeto_documentos (projeto_id, nome_arquivo, paginas, chunk_count, status, criado_em) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (projeto_id, arquivo.filename or sufixo, len(paginas), len(trechos_por_pagina), status, agora()),
        )
        conn.commit()
    return {"id": cur.lastrowid, "nome_arquivo": arquivo.filename, "paginas": len(paginas),
            "chunk_count": len(trechos_por_pagina), "status": status}


@router.post("/{projeto_id}/perguntar")
def perguntar_projeto(
    aluno_id: int,
    projeto_id: int,
    body: PerguntaProjeto,
    x_provider_api_key: str | None = Header(default=None),
):
    get_aluno(aluno_id)
    projeto = get_projeto(aluno_id, projeto_id)
    config = projeto_para_config(projeto)
    indice = obter_indice(projeto_id, config)

    try:
        resultado = engine_run(config, indice, body.pergunta, use_prompt=True, use_rag=True, api_key=x_provider_api_key)
    except Exception as e:
        raise HTTPException(502, f"Falha ao chamar a LLM: {e}")

    resposta_id = salvar_resposta(projeto_id, body.pergunta.strip(), "prompt_rag", resultado)
    return resultado_para_json(resultado, resposta_id, "prompt_rag")


@router.post("/{projeto_id}/comparar")
def comparar_projeto(
    aluno_id: int,
    projeto_id: int,
    body: PerguntaProjeto,
    x_provider_api_key: str | None = Header(default=None),
):
    get_aluno(aluno_id)
    projeto = get_projeto(aluno_id, projeto_id)
    config = projeto_para_config(projeto)
    indice = obter_indice(projeto_id, config)
    pergunta = body.pergunta.strip()

    camadas = [("puro", False, False), ("prompt", True, False), ("prompt_rag", True, True)]
    resultados = {}
    try:
        for modo, use_prompt, use_rag in camadas:
            resultado = engine_run(config, indice, pergunta, use_prompt=use_prompt, use_rag=use_rag, api_key=x_provider_api_key)
            resposta_id = salvar_resposta(projeto_id, pergunta, modo, resultado)
            resultados[modo] = resultado_para_json(resultado, resposta_id, modo)
    except Exception as e:
        raise HTTPException(502, f"Falha ao chamar a LLM: {e}")

    return {"pergunta": pergunta, "camadas": resultados}


@router.get("/{projeto_id}/comparacoes")
def comparacoes_projeto(aluno_id: int, projeto_id: int):
    get_aluno(aluno_id)
    get_projeto(aluno_id, projeto_id)
    with closing(db()) as conn:
        rows = conn.execute(
            "SELECT * FROM projeto_respostas WHERE projeto_id = ? ORDER BY id", (projeto_id,)
        ).fetchall()

    grupos: dict[str, dict] = {}
    for r in rows:
        resposta = {**dict(r), "trechos": json.loads(r["trechos_json"])}
        chave = " ".join(resposta["pergunta"].lower().split()).rstrip("?!. ")
        g = grupos.setdefault(chave, {"pergunta": resposta["pergunta"], "camadas": {}})
        g["camadas"][resposta["modo"]] = resposta  # a mais recente de cada camada vence
    return sorted(grupos.values(), key=lambda g: -len(g["camadas"]))


@router.get("/{projeto_id}/exportar")
def exportar_projeto(aluno_id: int, projeto_id: int):
    get_aluno(aluno_id)
    projeto = get_projeto(aluno_id, projeto_id)
    config = projeto_para_config(projeto)

    with closing(db()) as conn:
        docs = conn.execute(
            "SELECT nome_arquivo, paginas, chunk_count, status FROM projeto_documentos WHERE projeto_id = ? ORDER BY id",
            (projeto_id,),
        ).fetchall()

    config_sanitizado = {
        "schema_version": 1,
        "nome": projeto["nome"],
        "descricao": projeto["descricao"],
        "cenario_id": projeto["cenario_id"],
        "model_provider": config.model_provider,
        "model_name": config.model_name,
        "embedding_model": config.embedding_model,
        "prompt": {
            "persona": config.prompt.persona,
            "context": config.prompt.context,
            "instruction": config.prompt.instruction,
            "restriction": config.prompt.restriction,
            "output_format": config.prompt.output_format,
        },
        "retrieval": {
            "chunk_max_chars": config.retrieval.chunk_max_chars,
            "chunk_overlap_chars": config.retrieval.chunk_overlap_chars,
            "top_k": config.retrieval.top_k,
            "similarity_threshold": config.retrieval.similarity_threshold,
        },
        "documentos": [dict(d) for d in docs],
    }
    prompt_final_exemplo = build_prompt(config.prompt, chunks=[], use_prompt=True, use_rag=False)

    zip_bytes = build_export_zip(config_sanitizado, prompt_final_exemplo, pasta_uploads(projeto_id), projeto["nome"])
    nome_arquivo = f"projeto-{projeto_id}-{projeto['nome'].strip().lower().replace(' ', '-')}.zip"
    return StreamingResponse(
        iter([zip_bytes]),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={nome_arquivo}"},
    )
