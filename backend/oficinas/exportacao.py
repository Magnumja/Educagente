"""Exportação do relatório de uma oficina em CSV, para o facilitador abrir no Excel.

Entrada: uma `Oficina`. Saída: o texto do CSV, com uma linha por participante e
pergunta. Os dados vêm de `services.relatorio`, o mesmo usado no painel, então a
planilha e a tela mostram sempre a mesma coisa.

Quem chama: a rota `GET /api/facilitador/oficinas/{id}/export.csv` (`oficinas/api.py`).
"""
import csv
import io

from oficinas import services
from oficinas.models import Avaliacao, Oficina, Resposta

# BOM do UTF-8: sem ele o Excel abre o arquivo com os acentos trocados.
BOM = "﻿"

COLUNAS = [
    "participante_id", "apelido", "pergunta", "resposta_sem_contexto", "resposta_com_fontes",
    "fontes_citadas", "nada_relevante", "avaliou_primeira", "avaliou_segunda", "mais_confiavel",
    "conferiu_fonte", "observacao", "orientacao_dada", "fontes_na_base",
]


def nome_do_arquivo(oficina: Oficina) -> str:
    return f"oficina-{oficina.codigo}.csv"


def csv_do_relatorio(oficina: Oficina) -> str:
    relatorio = services.relatorio(oficina)
    texto_da_pergunta = {q.pk: q.texto for q in relatorio["perguntas"]}
    buffer = io.StringIO()
    escritor = csv.writer(buffer)
    escritor.writerow(COLUNAS)
    for participante in relatorio["participantes"]:
        for item in participante["perguntas"]:
            linha = _linha(participante, texto_da_pergunta[item["pergunta_id"]], item)
            escritor.writerow(_celula_segura(valor) for valor in linha)
    return BOM + buffer.getvalue()


def _linha(participante: dict, pergunta: str, item: dict) -> list:
    """Uma linha da planilha: as duas respostas e a avaliação de uma pergunta."""
    primeira: Resposta | None = item["primeira"]
    segunda: Resposta | None = item["segunda"]
    avaliacao: Avaliacao | None = item["avaliacao"]
    citadas = "; ".join(f"{t['documento']} p.{t['pagina']}" for t in (segunda.trechos if segunda else []))
    return [
        participante["id"],
        participante["apelido"],
        pergunta,
        primeira.texto if primeira else "",
        segunda.texto if segunda else "",
        citadas,
        "sim" if segunda and segunda.nada_relevante else "",
        avaliacao.primeira if avaliacao else "",
        avaliacao.segunda if avaliacao else "",
        avaliacao.mais_confiavel if avaliacao else "",
        ("sim" if avaliacao.conferiu_fonte else "não") if avaliacao else "",
        avaliacao.observacao if avaliacao else "",
        participante["orientacao"],
        "; ".join(participante["fontes"]),
    ]


def _celula_segura(valor) -> str:
    """Neutraliza fórmulas (CSV injection): o texto vem dos participantes e da IA, e o
    Excel executaria algo como `=HYPERLINK(...)`. O apóstrofo faz a célula virar texto."""
    texto = "" if valor is None else str(valor)
    return "'" + texto if texto[:1] in ("=", "+", "-", "@", "\t", "\r") else texto
