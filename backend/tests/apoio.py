"""Base dos testes: embeddings locais (sem Ollama) e um modelo de chat simulado.

Nenhum teste chama Ollama ou Anthropic de verdade.
"""
import json
from unittest import mock

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from rag.llm import RespostaDoModelo

SENHA = "senha-de-teste-bem-longa"
FONTE_PANTANAL = (
    "O Pantanal é a maior planície alagável do mundo e fica no Brasil, na Bolívia e no Paraguai.\n\n"
    "A onça-pintada vive no Pantanal e caça às margens dos rios.\n\n"
    "O tuiuiú é a ave símbolo do Pantanal."
)
PERGUNTAS = [
    {"texto": "Qual é a ave símbolo do Pantanal?", "referencia": "O tuiuiú."},
    {"texto": "Onde vive a onça-pintada do Pantanal?", "referencia": "Às margens dos rios."},
    {"texto": "Quem escreveu o livro Dom Casmurro?", "referencia": "Machado de Assis."},
]


class ModeloFalso:
    """Substitui `criar_adaptador`: registra cada chamada e devolve uma resposta previsível."""

    def __init__(self):
        self.chamadas: list[dict] = []

    def construir(self, provedor, modelo, chave=""):
        return self

    def conversar(self, sistema: str, pergunta: str) -> RespostaDoModelo:
        self.chamadas.append({"system": sistema, "question": pergunta})
        return RespostaDoModelo(texto=f"resposta para: {pergunta}", tokens_entrada=1, tokens_saida=1, tempo_segundos=0.0)


@override_settings(
    FACILITADOR_SENHA=SENHA, EMBEDDING_PROVIDER="local", MODEL_PROVIDER="demo", SIMILARITY_THRESHOLD=0.2, TOP_K=3
)
class TesteDaApi(TestCase):
    def setUp(self):
        cache.clear()  # zera os limites de uso entre testes
        self.modelo = ModeloFalso()
        patcher = mock.patch("oficinas.services.criar_adaptador", side_effect=self.modelo.construir)
        patcher.start()
        self.addCleanup(patcher.stop)

    def json(self, metodo: str, url: str, dados: dict | None = None, **headers):
        corpo = json.dumps(dados) if dados is not None else None
        return getattr(self.client, metodo)(url, corpo, content_type="application/json", headers=headers)

    def como_facilitador(self) -> dict:
        r = self.json("post", "/api/facilitador/entrar", {"senha": SENHA})
        self.assertEqual(r.status_code, 200, r.content)
        return {"Authorization": f"Bearer {r.json()['token']}"}

    def criar_oficina(self, com_fonte: bool = True) -> dict:
        auth = self.como_facilitador()
        r = self.json("post", "/api/facilitador/oficinas", {"titulo": "Oficina teste", "perguntas": PERGUNTAS}, **auth)
        self.assertEqual(r.status_code, 200, r.content)
        oficina = r.json()
        if com_fonte:
            arquivo = SimpleUploadedFile("pantanal.txt", FONTE_PANTANAL.encode(), content_type="text/plain")
            r = self.client.post(f"/api/facilitador/oficinas/{oficina['id']}/fontes", {"arquivo": arquivo}, headers=auth)
            self.assertEqual(r.status_code, 200, r.content)
        return oficina

    def entrar(self, codigo: str, apelido: str = "ana") -> tuple[dict, dict]:
        r = self.json("post", f"/api/oficinas/{codigo}/entrar", {"apelido": apelido, "consentimento": True})
        self.assertEqual(r.status_code, 200, r.content)
        corpo = r.json()
        return {"X-Participante": corpo["token"]}, corpo["estado"]

    def perguntar(self, auth: dict, pergunta_id: int, tentativa: int):
        return self.json("post", "/api/eu/perguntar", {"pergunta_id": pergunta_id, "tentativa": tentativa}, **auth)

    def enviar(self, url: str, nome: str, conteudo: bytes, **headers):
        arquivo = SimpleUploadedFile(nome, conteudo, content_type="application/octet-stream")
        return self.client.post(url, {"arquivo": arquivo}, headers=headers)
