"""Etapa 4 do RAG: achar os trechos mais parecidos com a pergunta.

Entrada: o vetor da pergunta e a matriz com os vetores dos trechos da base do
participante. Saída: lista de (posição do trecho na matriz, similaridade), do mais
parecido para o menos, limitada a `top_k`.

A medida é a similaridade de cosseno (1 = mesma direção, 0 = nada em comum). Abaixo do
limiar o trecho não entra: quando nada passa, a plataforma diz que não encontrou nada
relevante em vez de responder com contexto fraco.
"""
from __future__ import annotations

import numpy as np


def mais_parecidos(consulta: np.ndarray, matriz: np.ndarray, top_k: int, limiar: float) -> list[tuple[int, float]]:
    if matriz.size == 0:
        return []
    normas = np.linalg.norm(matriz, axis=1) * np.linalg.norm(consulta)
    # Vetor zerado (texto sem nenhuma palavra reconhecida) daria divisão por zero: vira similaridade 0.
    with np.errstate(divide="ignore", invalid="ignore"):
        similaridades = np.where(normas > 0, matriz @ consulta / normas, 0.0)
    ordem = np.argsort(-similaridades)[:top_k]
    return [(int(i), round(float(similaridades[i]), 3)) for i in ordem if similaridades[i] >= limiar]
