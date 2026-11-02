"""Recebe o conteúdo de um arquivo enviado, indexa e só então o grava no destino.

Gravar por último evita deixar no disco um documento que não entrou no índice (ex.:
Ollama fora do ar), o que faria a base exportada divergir do que o agente consulta.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from .chunking import chunk_text
from .ingestion import extrair_paginas
from .store import ProjectIndex


class ArquivoIlegivel(ValueError):
    """O arquivo não pôde ser lido (PDF corrompido, formato errado)."""


@dataclass
class ArquivoIndexado:
    paginas: int
    trechos: list[str]


def indexar_arquivo(
    conteudo: bytes,
    destino: Path,
    indice: ProjectIndex,
    doc_id: str,
    documento: str,
    chunk_max_chars: int = 600,
    chunk_overlap_chars: int = 80,
) -> ArquivoIndexado:
    destino.parent.mkdir(parents=True, exist_ok=True)
    # Mesmo sufixo do destino: a extração escolhe PDF/TXT pela extensão.
    temporario = destino.with_name(f".enviando-{destino.name}")
    temporario.write_bytes(conteudo)
    try:
        try:
            paginas = extrair_paginas(temporario)
        except Exception as erro:
            raise ArquivoIlegivel(f"Não foi possível ler o arquivo enviado: {erro}") from erro

        paginas_trechos = [
            (pagina.pagina, trecho)
            for pagina in paginas
            for trecho in chunk_text(pagina.texto, chunk_max_chars, chunk_overlap_chars)
            if trecho.strip()
        ]
        # Sem trechos, ainda assim remove os do envio anterior: o índice acompanha o arquivo.
        indice.add_document_chunks(doc_id=doc_id, documento=documento, paginas_trechos=paginas_trechos)
        os.replace(temporario, destino)
    finally:
        temporario.unlink(missing_ok=True)

    return ArquivoIndexado(paginas=len(paginas), trechos=[texto for _, texto in paginas_trechos])
