"""Busca por similaridade de cosseno entre a pergunta e os trechos da base.

Abaixo do limiar o trecho não entra: quando nada passa, a plataforma diz que não encontrou
nada relevante em vez de responder com contexto fraco.
"""
from __future__ import annotations

import numpy as np


def mais_parecidos(consulta: np.ndarray, matriz: np.ndarray, top_k: int, limiar: float) -> list[tuple[int, float]]:
    """Devolve (posição na matriz, similaridade) dos `top_k` melhores acima do limiar."""
    if matriz.size == 0:
        return []
    normas = np.linalg.norm(matriz, axis=1) * np.linalg.norm(consulta)
    with np.errstate(divide="ignore", invalid="ignore"):
        similaridades = np.where(normas > 0, matriz @ consulta / normas, 0.0)
    ordem = np.argsort(-similaridades)[:top_k]
    return [(int(i), round(float(similaridades[i]), 3)) for i in ordem if similaridades[i] >= limiar]
