"""Etapa 3 do RAG: transformar textos em vetores (embeddings).

Entrada: lista de textos (os trechos de uma fonte, ou a pergunta). Saída: matriz numpy
float32 com um vetor por texto. Textos com sentido parecido viram vetores que apontam
para direções parecidas, e é isso que a busca (`busca.py`) compara.

Dois provedores:
- "ollama": modelo `bge-m3` (multilíngue), rodando no servidor de IA da turma;
- "local": um saco de palavras com hash, sem nenhum serviço externo (modo demonstração
  e testes). Só aproxima textos com palavras em comum; serve para mostrar o fluxo, não
  para avaliar a qualidade da busca.
"""
from __future__ import annotations

import re
import unicodedata
import zlib

import numpy as np

DIMENSOES_LOCAL = 256


def gerar_embeddings(textos: list[str], provedor: str = "ollama", modelo: str = "bge-m3") -> np.ndarray:
    if not textos:
        return np.zeros((0, DIMENSOES_LOCAL), dtype=np.float32)
    if provedor == "local":
        return np.array([_saco_de_palavras(t) for t in textos], dtype=np.float32)
    # Import tardio: o modo "local" (testes, demonstração) funciona sem o pacote do Ollama.
    import ollama

    return np.array(ollama.embed(model=modelo, input=textos)["embeddings"], dtype=np.float32)


def _saco_de_palavras(texto: str) -> list[float]:
    """Conta as palavras do texto em 256 posições; um hash decide a posição de cada palavra."""
    sem_acento = unicodedata.normalize("NFD", texto.lower()).encode("ascii", "ignore").decode()
    vetor = [0.0] * DIMENSOES_LOCAL
    for palavra in re.findall(r"[a-z0-9]{3,}", sem_acento):
        # Só os 6 primeiros caracteres: "pantanal" e "pantaneiro" caem na mesma posição.
        vetor[zlib.crc32(palavra[:6].encode()) % DIMENSOES_LOCAL] += 1.0
    return vetor
