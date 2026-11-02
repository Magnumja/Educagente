"""Função central do núcleo. Contrato fixado com o usuário — não mudar sem checar com ele:

    run(config, index, question, use_prompt, use_rag, api_key=None) -> EngineResult

`api_key` é a chave do aluno (BYOK), usada só nesta chamada; sem ela vale a do `.env`.
"""
from __future__ import annotations

import time

from .llm import build_adapter
from .prompt_builder import build_prompt
from .schema import EngineResult, ProjectConfig
from .store import ProjectIndex


def run(
    config: ProjectConfig,
    index: ProjectIndex | None,
    question: str,
    use_prompt: bool,
    use_rag: bool,
    api_key: str | None = None,
) -> EngineResult:
    inicio = time.monotonic()
    chunks = []
    no_relevant_knowledge = False

    if use_rag and index is not None:
        chunks = index.search(
            question, top_k=config.retrieval.top_k, similarity_threshold=config.retrieval.similarity_threshold
        )
        no_relevant_knowledge = not chunks

    system = build_prompt(config.prompt, chunks, use_prompt=use_prompt, use_rag=use_rag)
    adapter = build_adapter(config.model_provider, config.model_name, api_key)
    resultado = adapter.chat(system=system or "Responda à pergunta do usuário.", question=question)

    return EngineResult(
        answer=resultado.answer,
        final_prompt_sent=system,
        used_chunks=chunks,
        time_seconds=round(resultado.time_seconds or (time.monotonic() - inicio), 3),
        tokens_in=resultado.tokens_in,
        tokens_out=resultado.tokens_out,
        no_relevant_knowledge=no_relevant_knowledge,
    )
