"""Corte de texto em trechos (chunks), respeitando parágrafos e um tamanho máximo.

Cada parágrafo vira um trecho, para a citação apontar uma ideia só. Parágrafos muito
curtos (títulos, linhas soltas) se juntam ao seguinte; um parágrafo maior que o limite é
cortado por sentença, com uma pequena sobreposição entre os pedaços.
"""
from __future__ import annotations

import re

TAMANHO_PADRAO = 500
SOBREPOSICAO_PADRAO = 60
PARAGRAFO_CURTO = 120


def chunk_text(texto: str, tamanho: int = TAMANHO_PADRAO, sobreposicao: int = SOBREPOSICAO_PADRAO) -> list[str]:
    paragrafos = [" ".join(p.split()) for p in re.split(r"\n\s*\n", texto)]
    paragrafos = [p for p in paragrafos if p]
    # PDF costuma vir sem linha em branco entre parágrafos: cai para quebras simples.
    if len(paragrafos) == 1 and len(paragrafos[0]) > tamanho:
        paragrafos = [" ".join(p.split()) for p in texto.splitlines() if p.strip()]

    trechos: list[str] = []
    pendente = ""  # parágrafo curto esperando o próximo
    for paragrafo in paragrafos:
        if pendente and len(pendente) + len(paragrafo) + 1 <= tamanho:
            paragrafo = f"{pendente}\n{paragrafo}"
        elif pendente:
            trechos.append(pendente)
        pendente = ""
        if len(paragrafo) > tamanho:
            trechos.extend(_corta_por_sentenca(paragrafo, tamanho, sobreposicao))
        elif len(paragrafo) < PARAGRAFO_CURTO:
            pendente = paragrafo
        else:
            trechos.append(paragrafo)
    if pendente:
        trechos.append(pendente)
    return trechos


def _corta_por_sentenca(texto: str, tamanho: int, sobreposicao: int) -> list[str]:
    partes: list[str] = []
    atual = ""
    passo = max(tamanho - sobreposicao, 1)
    for sentenca in re.split(r"(?<=[.!?;:])\s+", texto):
        # Sentença sem pontuação maior que o limite: corte seco.
        while len(sentenca) > tamanho:
            if atual:
                partes.append(atual)
                atual = ""
            partes.append(sentenca[:tamanho])
            sentenca = sentenca[passo:]
        if atual and len(atual) + len(sentenca) + 1 > tamanho:
            partes.append(atual)
            cauda = atual[-sobreposicao:].split(" ", 1)[-1] if sobreposicao else ""
            atual = f"{cauda} {sentenca}".strip()
        else:
            atual = f"{atual} {sentenca}".strip()
    if atual:
        partes.append(atual)
    return partes
