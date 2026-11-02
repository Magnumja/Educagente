"""Importação do banco da versão FastAPI, com um banco legado sintético no mesmo esquema."""
import io
import json
import sqlite3
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from oficina.models import Aluno, Resposta
from projetos.models import Projeto, ProjetoDocumento, ProjetoResposta

ESQUEMA_LEGADO = """
CREATE TABLE alunos (id INTEGER PRIMARY KEY AUTOINCREMENT, apelido TEXT NOT NULL, turma TEXT,
    consentimento INTEGER NOT NULL, criado_em TEXT NOT NULL);
CREATE TABLE respostas (id INTEGER PRIMARY KEY AUTOINCREMENT, aluno_id INTEGER NOT NULL, etapa INTEGER NOT NULL,
    pergunta TEXT NOT NULL, resposta TEXT NOT NULL, trechos TEXT NOT NULL, criado_em TEXT NOT NULL);
CREATE TABLE projetos (id INTEGER PRIMARY KEY AUTOINCREMENT, aluno_id INTEGER NOT NULL, nome TEXT NOT NULL,
    descricao TEXT, cenario_id TEXT, model_provider TEXT NOT NULL, model_name TEXT NOT NULL,
    embedding_model TEXT NOT NULL, prompt_persona TEXT NOT NULL DEFAULT '', prompt_context TEXT NOT NULL DEFAULT '',
    prompt_instruction TEXT NOT NULL DEFAULT '', prompt_restriction TEXT NOT NULL DEFAULT '',
    prompt_output_format TEXT NOT NULL DEFAULT '', chunk_max_chars INTEGER NOT NULL DEFAULT 600,
    chunk_overlap_chars INTEGER NOT NULL DEFAULT 80, top_k INTEGER NOT NULL DEFAULT 4,
    similarity_threshold REAL NOT NULL DEFAULT 0.5, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL);
CREATE TABLE projeto_documentos (id INTEGER PRIMARY KEY AUTOINCREMENT, projeto_id INTEGER NOT NULL,
    nome_arquivo TEXT NOT NULL, paginas INTEGER NOT NULL, chunk_count INTEGER NOT NULL, status TEXT NOT NULL,
    criado_em TEXT NOT NULL);
CREATE TABLE projeto_respostas (id INTEGER PRIMARY KEY AUTOINCREMENT, projeto_id INTEGER NOT NULL,
    pergunta TEXT NOT NULL, modo TEXT NOT NULL, resposta TEXT NOT NULL, trechos_json TEXT NOT NULL,
    tempo_segundos REAL NOT NULL, tokens_in INTEGER NOT NULL, tokens_out INTEGER NOT NULL,
    nada_relevante INTEGER NOT NULL, criado_em TEXT NOT NULL);
"""
DATA = "2026-10-20T20:35:00+00:00"
TRECHO = {"texto": "O tuiuiú é a ave símbolo.", "documento": "pantanal.txt", "pagina": 1, "similaridade": 0.8}


def criar_banco_legado(caminho: Path) -> None:
    with sqlite3.connect(caminho) as banco:
        banco.executescript(ESQUEMA_LEGADO)
        banco.execute("INSERT INTO alunos VALUES (3, 'visitante', NULL, 1, ?)", (DATA,))
        banco.execute("INSERT INTO alunos VALUES (7, 'grupo azul', 'turma A', 1, ?)", (DATA,))
        banco.execute("INSERT INTO respostas VALUES (5, 3, 2, 'Qual a ave?', 'Tuiuiú [1]', ?, ?)", (json.dumps([TRECHO]), DATA))
        banco.execute("INSERT INTO respostas VALUES (6, 99, 1, 'órfã', 'sem aluno', '[]', ?)", (DATA,))
        banco.execute(
            "INSERT INTO projetos (id, aluno_id, nome, model_provider, model_name, embedding_model, prompt_persona,"
            " top_k, criado_em, atualizado_em) VALUES (4, 7, 'Guia', 'ollama', 'llama3.2:1b', 'bge-m3', 'Guia.', 2, ?, ?)",
            (DATA, DATA),
        )
        banco.execute("INSERT INTO projeto_documentos VALUES (1, 4, 'onca.txt', 1, 2, 'pronto', ?)", (DATA,))
        banco.execute("INSERT INTO projeto_documentos VALUES (2, 4, 'onca.txt', 1, 3, 'pronto', ?)", (DATA,))
        banco.execute(
            "INSERT INTO projeto_respostas VALUES (8, 4, 'Qual a ave?', 'prompt_rag', 'Tuiuiú', ?, 1.5, 10, 5, 0, ?)",
            (json.dumps([TRECHO]), DATA),
        )


class ImportacaoTest(TestCase):
    def setUp(self):
        pasta = tempfile.TemporaryDirectory()
        self.addCleanup(pasta.cleanup)
        self.pasta = Path(pasta.name)
        self.origem = self.pasta / "oficina.db"
        criar_banco_legado(self.origem)

    def importar(self) -> str:
        saida = io.StringIO()
        call_command("importar_banco_legado", origem=self.origem, stdout=saida)
        return saida.getvalue()

    def test_importa_mantendo_ids_e_relacionamentos(self):
        self.importar()
        self.assertEqual(sorted(Aluno.objects.values_list("pk", flat=True)), [3, 7])
        resposta = Resposta.objects.get(pk=5)
        self.assertEqual((resposta.aluno_id, resposta.etapa, resposta.trechos), (3, 2, [TRECHO]))
        projeto = Projeto.objects.get(pk=4)
        self.assertEqual((projeto.aluno_id, projeto.prompt_persona, projeto.top_k), (7, "Guia.", 2))
        self.assertEqual(projeto.criado_em.isoformat(), DATA)
        projeto_resposta = ProjetoResposta.objects.get(pk=8)
        self.assertEqual((projeto_resposta.nada_relevante, projeto_resposta.trechos), (False, [TRECHO]))

    def test_ignora_orfaos_e_mantem_o_documento_mais_recente(self):
        saida = self.importar()
        self.assertFalse(Resposta.objects.filter(pk=6).exists())
        self.assertEqual(list(ProjetoDocumento.objects.values_list("pk", "chunk_count")), [(2, 3)])
        self.assertIn("respostas: 1 importados, 1 órfãos", saida)

    def test_rodar_de_novo_nao_duplica_e_faz_um_backup_so(self):
        self.importar()
        segunda = self.importar()
        # A resposta órfã nunca entra, então a segunda execução ainda confere, mas não insere nada.
        self.assertIn("alunos: 0 importados", segunda)
        self.assertIn("projeto_respostas: 0 importados", segunda)
        self.assertEqual(Aluno.objects.count(), 2)
        self.assertEqual(len(list((self.pasta / "backups").glob("oficina-*.db"))), 1)
        self.assertGreater(Aluno.objects.create(apelido="novo", consentimento=True).pk, 7)

    def test_sem_banco_legado_nao_faz_nada(self):
        saida = io.StringIO()
        call_command("importar_banco_legado", origem=self.pasta / "inexistente.db", stdout=saida)
        self.assertIn("nada a importar", saida.getvalue())
