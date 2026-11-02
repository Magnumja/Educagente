"""Corte de texto em trechos (chunks), respeitando parágrafos e um tamanho máximo.

Cada parágrafo vira um trecho; um parágrafo maior que `chunk_max_chars` cai no corte por
sentença (fallback), documentado como limitação conhecida.
"""
from __future__ import annotations

import re


def chunk_text(texto: str, chunk_max_chars: int = 600, chunk_overlap_chars: int = 80) -> list[str]:
    paragrafos = [p.strip() for p in re.split(r"\n\s*\n", texto) if p.strip()]
    if not paragrafos:
        return []

    trechos: list[str] = []
    for paragrafo in paragrafos:
        if len(paragrafo) <= chunk_max_chars:
            trechos.append(paragrafo)
        else:
            trechos.extend(_corta_por_sentenca(paragrafo, chunk_max_chars, chunk_overlap_chars))
    return trechos


def _corta_por_sentenca(texto: str, tamanho: int, sobreposicao: int) -> list[str]:
    sentencas = re.split(r"(?<=[.!?])\s+", texto)
    partes: list[str] = []
    atual = ""
    for sentenca in sentencas:
        if atual and len(atual) + len(sentenca) + 1 > tamanho:
            partes.append(atual)
            atual = (atual[-sobreposicao:] + " " + sentenca) if sobreposicao else sentenca
        else:
            atual = f"{atual} {sentenca}".strip()
    if atual:
        partes.append(atual)
    return partes
