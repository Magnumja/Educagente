"""Etapa 1 do RAG: extrair o texto de um arquivo enviado.

Entrada: nome do arquivo e seus bytes. Saída: lista de `PaginaExtraida` (PDF página a
página com pypdf; TXT vira uma página única). Quem chama é `oficinas/services.py`, antes
do corte em trechos.

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
    """Escolhe o leitor pela extensão do arquivo."""
    extensao = PurePath(nome_arquivo).suffix.lower()
    if extensao == ".pdf":
        return _extrair_pdf(conteudo)
    if extensao == ".txt":
        return [PaginaExtraida(pagina=1, texto=_decodificar_txt(conteudo).strip())]
    raise ArquivoIlegivel("Envie um arquivo PDF ou TXT.")


def _decodificar_txt(conteudo: bytes) -> str:
    # Bloco de notas do Windows ainda salva em ANSI (cp1252) com frequência.
    for codificacao in ("utf-8-sig", "cp1252"):
        try:
            return conteudo.decode(codificacao)
        except UnicodeDecodeError:
            continue
    return conteudo.decode("utf-8", errors="ignore")


def _extrair_pdf(conteudo: bytes) -> list[PaginaExtraida]:
    # Import tardio: o pypdf só é carregado quando alguém envia um PDF.
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        leitor = PdfReader(io.BytesIO(conteudo))
        if leitor.is_encrypted:
            raise ArquivoIlegivel("O PDF está protegido por senha.")
        if len(leitor.pages) > MAX_PAGINAS:
            raise ArquivoIlegivel(f"O PDF tem mais de {MAX_PAGINAS} páginas. Envie só a parte que interessa.")
        return [
            PaginaExtraida(pagina=numero, texto=(pagina.extract_text() or "").strip())
            for numero, pagina in enumerate(leitor.pages, start=1)
        ]
    except ArquivoIlegivel:
        raise
    except (PdfReadError, ValueError, KeyError, OSError) as erro:
        # O pypdf solta erros variados para arquivos quebrados; o participante só precisa saber disto.
        raise ArquivoIlegivel("Não foi possível ler o PDF. Ele pode estar corrompido.") from erro
