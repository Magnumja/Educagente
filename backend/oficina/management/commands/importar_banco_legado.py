"""Importa o banco da versão FastAPI (`data/oficina.db`) mantendo os ids, porque índices,
uploads e o `localStorage` dos alunos apontam para eles.

Pode rodar várias vezes: ids já existentes são pulados (nada é duplicado nem
sobrescrito). Antes de inserir, copia o banco legado para `data/backups/`.
"""
import json
import sqlite3
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from oficina.models import Aluno, Resposta
from projetos.models import Projeto, ProjetoDocumento, ProjetoResposta


def data(texto: str) -> datetime:
    return datetime.fromisoformat(texto)


def campos_aluno(linha) -> dict:
    return {
        "apelido": linha["apelido"],
        "turma": linha["turma"],
        "consentimento": bool(linha["consentimento"]),
        "criado_em": data(linha["criado_em"]),
    }


def campos_resposta(linha) -> dict:
    return {
        "aluno_id": linha["aluno_id"],
        "etapa": linha["etapa"],
        "pergunta": linha["pergunta"],
        "resposta": linha["resposta"],
        "trechos": json.loads(linha["trechos"]),
        "criado_em": data(linha["criado_em"]),
    }


def campos_projeto(linha) -> dict:
    campos = {nome: linha[nome] for nome in linha.keys() if nome not in ("id", "criado_em", "atualizado_em")}
    return {**campos, "criado_em": data(linha["criado_em"]), "atualizado_em": data(linha["atualizado_em"])}


def campos_documento(linha) -> dict:
    campos = {nome: linha[nome] for nome in ("projeto_id", "nome_arquivo", "paginas", "chunk_count", "status")}
    return {**campos, "criado_em": data(linha["criado_em"])}


def campos_projeto_resposta(linha) -> dict:
    campos = {
        nome: linha[nome]
        for nome in ("projeto_id", "pergunta", "modo", "resposta", "tempo_segundos", "tokens_in", "tokens_out")
    }
    return {
        **campos,
        "trechos": json.loads(linha["trechos_json"]),
        "nada_relevante": bool(linha["nada_relevante"]),
        "criado_em": data(linha["criado_em"]),
    }


# (tabela legada, model, conversão, campo do pai, model do pai) — pais antes dos filhos.
TABELAS = [
    ("alunos", Aluno, campos_aluno, None, None),
    ("respostas", Resposta, campos_resposta, "aluno_id", Aluno),
    ("projetos", Projeto, campos_projeto, "aluno_id", Aluno),
    ("projeto_documentos", ProjetoDocumento, campos_documento, "projeto_id", Projeto),
    ("projeto_respostas", ProjetoResposta, campos_projeto_resposta, "projeto_id", Projeto),
]


class Command(BaseCommand):
    help = "Importa data/oficina.db (versão FastAPI) para o banco do Django, sem duplicar."

    def add_arguments(self, parser):
        parser.add_argument("--origem", type=Path, default=settings.LEGACY_DB_PATH)

    def handle(self, *args, origem: Path, **options):
        if not origem.exists():
            self.stdout.write(f"Sem banco legado em {origem}; nada a importar.")
            return

        legado = sqlite3.connect(f"file:{origem}?mode=ro", uri=True)
        legado.row_factory = sqlite3.Row
        linhas_por_tabela = {
            tabela: legado.execute(f"SELECT * FROM {tabela} ORDER BY id").fetchall() for tabela, *_ in TABELAS
        }
        legado.close()

        pendentes = sum(
            1
            for tabela, model, *_ in TABELAS
            for linha in linhas_por_tabela[tabela]
            if not model.objects.filter(pk=linha["id"]).exists()
        )
        if pendentes:
            self.stdout.write(f"Backup do banco legado: {self.fazer_backup(origem)}")
            with transaction.atomic():
                for tabela, model, converter, campo_pai, model_pai in TABELAS:
                    self.importar_tabela(tabela, linhas_por_tabela[tabela], model, converter, campo_pai, model_pai)
        else:
            self.stdout.write("Banco legado já importado; nada novo.")

        for tabela, model, *_ in TABELAS:
            self.stdout.write(f"  {tabela}: legado={len(linhas_por_tabela[tabela])} django={model.objects.count()}")

    def fazer_backup(self, origem: Path) -> Path:
        """Uma cópia basta: o banco legado só é lido, nunca alterado."""
        pasta = origem.parent / "backups"
        pasta.mkdir(exist_ok=True)
        anteriores = sorted(pasta.glob(f"{origem.stem}-*.db"))
        if anteriores:
            return anteriores[-1]
        destino = pasta / f"{origem.stem}-{timezone.now():%Y%m%d-%H%M%S}.db"
        with sqlite3.connect(origem) as fonte, sqlite3.connect(destino) as copia:
            fonte.backup(copia)
        return destino

    def importar_tabela(self, tabela, linhas, model, converter, campo_pai, model_pai):
        existentes = set(model.objects.values_list("pk", flat=True))
        pais = set(model_pai.objects.values_list("pk", flat=True)) if model_pai else None
        documentos_vistos = set(ProjetoDocumento.objects.values_list("projeto_id", "nome_arquivo"))
        if model is ProjetoDocumento:
            # A versão antiga registrava o mesmo arquivo mais de uma vez; vale o envio mais recente,
            # que é o que está no índice.
            linhas = list(reversed(linhas))
        novos, orfaos, duplicados = [], 0, 0

        for linha in linhas:
            if linha["id"] in existentes:
                continue
            if pais is not None and linha[campo_pai] not in pais:
                orfaos += 1
                continue
            campos = converter(linha)
            if model is ProjetoDocumento:
                chave = (campos["projeto_id"], campos["nome_arquivo"])
                if chave in documentos_vistos:
                    duplicados += 1
                    continue
                documentos_vistos.add(chave)
            novos.append(model(id=linha["id"], **campos))

        model.objects.bulk_create(novos)
        self.stdout.write(f"{tabela}: {len(novos)} importados, {orfaos} órfãos e {duplicados} duplicados ignorados")
