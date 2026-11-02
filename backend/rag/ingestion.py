"""Extração de texto de documentos enviados: PDF por página (pypdf), TXT como página única.

Se a extração vier vazia (ex.: PDF escaneado sem OCR), a página retorna com `texto=""` em vez
de falhar — quem chama decide o que fazer (hoje: a página some do índice).
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class PaginaExtraida:
    pagina: int
    texto: str


FORMATOS_ACEITOS = (".pdf", ".txt")


def extrair_paginas(caminho: Path) -> list[PaginaExtraida]:
    sufixo = caminho.suffix.lower()
    if sufixo == ".pdf":
        return _extrair_pdf(caminho)
    if sufixo == ".txt":
        return _extrair_txt(caminho)
    raise ValueError(f"Formato não suportado: {sufixo} (use PDF ou TXT)")


def _extrair_pdf(caminho: Path) -> list[PaginaExtraida]:
    from pypdf import PdfReader

    leitor = PdfReader(str(caminho))
    paginas = []
    for i, pagina in enumerate(leitor.pages, start=1):
        texto = (pagina.extract_text() or "").strip()
        paginas.append(PaginaExtraida(pagina=i, texto=texto))
    return paginas


def _extrair_txt(caminho: Path) -> list[PaginaExtraida]:
    texto = caminho.read_text(encoding="utf-8", errors="ignore").strip()
    return [PaginaExtraida(pagina=1, texto=texto)]
