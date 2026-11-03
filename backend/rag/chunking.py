"""Etapa 2 do RAG: cortar o texto em trechos (chunks).

Entrada: o texto de uma página. Saída: lista de trechos de até `tamanho` caracteres.
Cada trecho vira uma linha da tabela `Trecho` e ganha seu próprio embedding.

Regras do corte:
- cada parágrafo vira um trecho, para a citação [1] apontar uma ideia só;
- parágrafos muito curtos (títulos, linhas soltas) se juntam ao seguinte;
- um parágrafo maior que o limite é cortado por sentença, com uma pequena
  sobreposição entre os pedaços (para não perder o contexto na emenda).
"""
from __future__ import annotations

import re

TAMANHO_PADRAO = 500
SOBREPOSICAO_PADRAO = 60
PARAGRAFO_CURTO = 120


def dividir_em_trechos(texto: str, tamanho: int = TAMANHO_PADRAO, sobreposicao: int = SOBREPOSICAO_PADRAO) -> list[str]:
    trechos: list[str] = []
    pendente = ""  # parágrafo curto esperando para se juntar ao próximo
    for paragrafo in _separar_paragrafos(texto, tamanho):
        if pendente and len(pendente) + len(paragrafo) + 1 <= tamanho:
            paragrafo = f"{pendente}\n{paragrafo}"
        elif pendente:
            trechos.append(pendente)
        pendente = ""
        if len(paragrafo) > tamanho:
            trechos.extend(_cortar_por_sentenca(paragrafo, tamanho, sobreposicao))
        elif len(paragrafo) < PARAGRAFO_CURTO:
            pendente = paragrafo
        else:
            trechos.append(paragrafo)
    if pendente:
        trechos.append(pendente)
    return trechos


def _separar_paragrafos(texto: str, tamanho: int) -> list[str]:
    """Parágrafos separados por linha em branco, com os espaços normalizados."""
    paragrafos = [_normalizar_espacos(p) for p in re.split(r"\n\s*\n", texto)]
    paragrafos = [p for p in paragrafos if p]
    # PDF costuma vir sem linha em branco entre parágrafos: cai para quebras simples.
    if len(paragrafos) == 1 and len(paragrafos[0]) > tamanho:
        paragrafos = [_normalizar_espacos(linha) for linha in texto.splitlines() if linha.strip()]
    return paragrafos


def _normalizar_espacos(texto: str) -> str:
    return " ".join(texto.split())


def _cortar_por_sentenca(texto: str, tamanho: int, sobreposicao: int) -> list[str]:
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
            # Repete o fim do pedaço anterior (a partir de uma palavra inteira) no começo do próximo.
            cauda = atual[-sobreposicao:].split(" ", 1)[-1] if sobreposicao else ""
            atual = f"{cauda} {sentenca}".strip()
        else:
            atual = f"{atual} {sentenca}".strip()
    if atual:
        partes.append(atual)
    return partes
