"""Embeddings: `bge-m3` (multilíngue) via Ollama, ou "local", um saco de palavras com hash
que roda sem nenhum serviço externo (modo demonstração e testes).

O "local" só aproxima textos com palavras em comum; serve para mostrar o fluxo, não para
avaliar a qualidade da busca.
"""
from __future__ import annotations

import re
import unicodedata
import zlib

import numpy as np

DIMENSOES_LOCAL = 256


def embed(textos: list[str], provider: str = "ollama", model: str = "bge-m3") -> np.ndarray:
    if not textos:
        return np.zeros((0, DIMENSOES_LOCAL), dtype=np.float32)
    if provider == "local":
        return np.array([_saco_de_palavras(t) for t in textos], dtype=np.float32)
    import ollama

    return np.array(ollama.embed(model=model, input=textos)["embeddings"], dtype=np.float32)


def _saco_de_palavras(texto: str) -> list[float]:
    sem_acento = unicodedata.normalize("NFD", texto.lower()).encode("ascii", "ignore").decode()
    vetor = [0.0] * DIMENSOES_LOCAL
    for palavra in re.findall(r"[a-z0-9]{3,}", sem_acento):
        vetor[zlib.crc32(palavra[:6].encode()) % DIMENSOES_LOCAL] += 1.0
    return vetor
