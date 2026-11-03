"""Extração de texto de documentos enviados: PDF por página (pypdf), TXT como página única.

Tudo acontece em memória: o arquivo original não é guardado no servidor, só os trechos
de texto e seus embeddings (menos dado pessoal parado em disco).
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import PurePath

FORMATOS_ACEITOS = (".pdf", ".txt")
MAX_PAGINAS = 60


class ArquivoIlegivel(ValueError):
    """O arquivo não pôde ser lido (PDF corrompido, formato errado, grande demais)."""


@dataclass
class PaginaExtraida:
    pagina: int
    texto: str


def extrair_paginas(nome_arquivo: str, conteudo: bytes) -> list[PaginaExtraida]:
    sufixo = PurePath(nome_arquivo).suffix.lower()
    if sufixo == ".pdf":
        return _extrair_pdf(conteudo)
    if sufixo == ".txt":
        return [PaginaExtraida(pagina=1, texto=_decodificar(conteudo).strip())]
    raise ArquivoIlegivel("Envie um arquivo PDF ou TXT.")


def _decodificar(conteudo: bytes) -> str:
    # Bloco de notas do Windows ainda salva em ANSI (cp1252) com frequência.
    for codificacao in ("utf-8-sig", "cp1252"):
        try:
            return conteudo.decode(codificacao)
        except UnicodeDecodeError:
            continue
    return conteudo.decode("utf-8", errors="ignore")


def _extrair_pdf(conteudo: bytes) -> list[PaginaExtraida]:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        leitor = PdfReader(io.BytesIO(conteudo))
        if leitor.is_encrypted:
            raise ArquivoIlegivel("O PDF está protegido por senha.")
        if len(leitor.pages) > MAX_PAGINAS:
            raise ArquivoIlegivel(f"O PDF tem mais de {MAX_PAGINAS} páginas. Envie só a parte que interessa.")
        return [
            PaginaExtraida(pagina=i, texto=(pagina.extract_text() or "").strip())
            for i, pagina in enumerate(leitor.pages, start=1)
        ]
    except ArquivoIlegivel:
        raise
    except (PdfReadError, ValueError, KeyError, OSError) as erro:
        raise ArquivoIlegivel("Não foi possível ler o PDF. Ele pode estar corrompido.") from erro
