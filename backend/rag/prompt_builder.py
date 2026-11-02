"""Monta o prompt final em ordem fixa: persona → contexto → instrução → restrição → formato
→ trechos da base de conhecimento (se RAG) → pergunta (enviada separadamente pelo adaptador).

Os interruptores `use_prompt`/`use_rag` removem blocos inteiros, nunca campos isolados.
"""
from __future__ import annotations

from .schema import PromptConfig, UsedChunk

NADA_ENCONTRADO = "Nenhum trecho relevante foi encontrado na base de conhecimento."


def build_prompt(prompt: PromptConfig, chunks: list[UsedChunk], use_prompt: bool, use_rag: bool) -> str:
    blocos: list[str] = []

    if use_prompt:
        for campo in (prompt.persona, prompt.context, prompt.instruction, prompt.restriction, prompt.output_format):
            if campo:
                blocos.append(campo)

    if use_rag:
        if chunks:
            trechos = "\n".join(f"[{i}] ({c.documento}, p.{c.pagina}) {c.texto}" for i, c in enumerate(chunks, 1))
            blocos.append(f"Trechos da base de conhecimento:\n{trechos}")
        else:
            blocos.append(NADA_ENCONTRADO)

    return "\n\n".join(blocos)
