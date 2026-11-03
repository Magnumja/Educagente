"""Adaptadores de chat atrás da mesma interface. O modelo é escolhido pela equipe no
`backend/.env`; o participante nunca escolhe modelo nem informa chave.
"""
from __future__ import annotations

import time
from dataclasses import dataclass


@dataclass
class ChatResult:
    answer: str
    tokens_in: int
    tokens_out: int
    time_seconds: float


class FalhaDoProvedor(Exception):
    """O provedor de IA não respondeu. A mensagem já vem pronta para o participante."""


class ChatAdapter:
    def chat(self, system: str, question: str) -> ChatResult:
        raise NotImplementedError


class OllamaAdapter(ChatAdapter):
    def __init__(self, model: str):
        self.model = model

    def chat(self, system: str, question: str) -> ChatResult:
        import ollama

        inicio = time.monotonic()
        try:
            resp = ollama.chat(
                model=self.model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": question}],
                stream=False,
            )
        except Exception as erro:
            raise FalhaDoProvedor("O servidor de IA da turma (Ollama) não respondeu. Avise o facilitador.") from erro
        return ChatResult(
            answer=resp["message"]["content"],
            tokens_in=resp.get("prompt_eval_count", 0) or 0,
            tokens_out=resp.get("eval_count", 0) or 0,
            time_seconds=time.monotonic() - inicio,
        )


class AnthropicAdapter(ChatAdapter):
    def __init__(self, model: str, api_key: str):
        self.model = model
        self.api_key = api_key

    def chat(self, system: str, question: str) -> ChatResult:
        import anthropic

        inicio = time.monotonic()
        try:
            msg = anthropic.Anthropic(api_key=self.api_key).messages.create(
                model=self.model,
                max_tokens=700,
                system=system,
                messages=[{"role": "user", "content": question}],
            )
        except anthropic.RateLimitError as erro:
            raise FalhaDoProvedor("Muitas perguntas ao mesmo tempo. Espere alguns segundos e tente de novo.") from erro
        except anthropic.AuthenticationError as erro:
            raise FalhaDoProvedor("A chave de IA do servidor é inválida. Avise o facilitador.") from erro
        except anthropic.APIError as erro:
            raise FalhaDoProvedor("O serviço de IA não respondeu agora. Tente de novo em instantes.") from erro
        return ChatResult(
            answer="".join(b.text for b in msg.content if b.type == "text"),
            tokens_in=msg.usage.input_tokens,
            tokens_out=msg.usage.output_tokens,
            time_seconds=time.monotonic() - inicio,
        )


class DemoAdapter(ChatAdapter):
    """Sem modelo de verdade: devolve os trechos recebidos, para o fluxo funcionar offline."""

    AVISO = "[Modo demonstração: nenhuma IA real foi consultada.]\n\n"

    def chat(self, system: str, question: str) -> ChatResult:
        marcador = "TRECHOS DAS FONTES:\n"
        if marcador in system:
            # Repete o começo do trecho mais parecido, citando-o, como uma IA obediente faria.
            primeiro = system.split(marcador, 1)[1].split("\n[2]", 1)[0]
            texto = " ".join(primeiro.split(") ", 1)[-1].split())
            resposta = self.AVISO + f"Segundo as fontes: {texto[:280].rstrip()}… [1]"
        else:
            resposta = (
                self.AVISO + "Uma IA real responderia de memória aqui, e poderia acertar, errar ou inventar "
                "detalhes com toda a segurança."
            )
        return ChatResult(answer=resposta, tokens_in=0, tokens_out=0, time_seconds=0.0)


def build_adapter(provider: str, model: str, api_key: str = "") -> ChatAdapter:
    if provider == "ollama":
        return OllamaAdapter(model)
    if provider == "anthropic" and api_key:
        return AnthropicAdapter(model, api_key)
    return DemoAdapter()
