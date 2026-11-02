"""Base dos testes: pasta de dados temporária, Ollama e provedores de IA simulados.

Nenhum teste chama Ollama, Anthropic ou OpenAI de verdade.
"""
import json
import os
import re
import tempfile
import zlib
from pathlib import Path
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from rag.llm import ChatResult
from rag.llm import build_adapter as build_adapter_real

DOCUMENTO_PANTANAL = (
    "O Pantanal é a maior planície alagável do mundo.\n\n"
    "A onça-pintada vive no Pantanal e caça às margens dos rios.\n\n"
    "O tuiuiú é a ave símbolo do Pantanal."
)
PERGUNTA_COM_RESPOSTA = "Qual é a ave símbolo do Pantanal?"
PERGUNTA_SEM_RESPOSTA = "Quem escreveu Dom Casmurro?"


def embed_falso(textos: list[str], model: str = "") -> list[list[float]]:
    """Saco de palavras com hash: textos com palavras em comum ficam próximos no cosseno."""
    vetores = []
    for texto in textos:
        vetor = [0.0] * 64
        for palavra in re.findall(r"\w{3,}", texto.lower()):
            vetor[zlib.crc32(palavra.encode()) % 64] += 1.0
        vetores.append(vetor)
    return vetores


class LLMFalsa:
    """Substitui `build_adapter`: registra provedor, chave e prompt de cada chamada."""

    def __init__(self):
        self.chamadas: list[dict] = []
        self.erro: Exception | None = None
        self.usar_real = False  # para testar o DemoAdapter de verdade

    def construir(self, provider, model, api_key=None):
        if self.usar_real:
            return build_adapter_real(provider, model, api_key)
        self.chamadas.append({"provider": provider, "model": model, "api_key": api_key})
        return self

    def chat(self, system: str, question: str) -> ChatResult:
        if self.erro:
            raise self.erro
        self.chamadas[-1]["system"] = system
        return ChatResult(answer=f"resposta para: {question}", tokens_in=10, tokens_out=5, time_seconds=0.01)


class TesteDaApi(TestCase):
    def setUp(self):
        pasta = tempfile.TemporaryDirectory()
        self.addCleanup(pasta.cleanup)
        self.data_dir = Path(pasta.name)
        self.ativar(override_settings(DATA_DIR=self.data_dir, MODEL_PROVIDER="anthropic", LLM_MODEL="modelo-teste"))
        # Garante que uma chave real do .env nunca seja usada nos testes.
        self.ativar(mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "", "OPENAI_API_KEY": ""}))
        self.embed = self.ativar(mock.patch("rag.store.embed", side_effect=embed_falso))
        self.llm = LLMFalsa()
        self.ativar(mock.patch("rag.engine.build_adapter", side_effect=self.llm.construir))

    def ativar(self, patcher):
        valor = patcher.__enter__()
        self.addCleanup(patcher.__exit__, None, None, None)
        return valor

    def post_json(self, url: str, dados: dict, **headers):
        return self.client.post(url, json.dumps(dados), content_type="application/json", headers=headers)

    def enviar_arquivo(self, url: str, nome: str, conteudo: str, **campos):
        arquivo = SimpleUploadedFile(nome, conteudo.encode("utf-8"), content_type="text/plain")
        return self.client.post(url, {"arquivo": arquivo, **campos})

    def criar_aluno(self) -> int:
        resposta = self.post_json("/api/alunos", {"apelido": "visitante", "turma": None, "consentimento": True})
        self.assertEqual(resposta.status_code, 200, resposta.content)
        return resposta.json()["id"]
