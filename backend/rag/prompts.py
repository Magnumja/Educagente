"""Etapa 5 do RAG: montar as instruções (prompt de sistema) enviadas ao modelo.

Tentativa 1 (sem contexto): só a configuração pré-definida, sem materiais.
Tentativa 2 (com fontes): a regra de usar só as fontes, a orientação do participante e
os trechos recuperados pela busca, numerados para a IA citar [1], [2]...

O texto montado aqui é guardado em `Resposta.instrucoes_enviadas` e mostrado ao
participante: ele vê exatamente o que a IA recebeu.
"""
from __future__ import annotations

from dataclasses import dataclass

SISTEMA_SEM_CONTEXTO = "Você é um assistente. Responda em português do Brasil, em até dois parágrafos curtos."

SISTEMA_COM_FONTES = (
    "Você é um assistente de estudo. Responda em português do Brasil, em até dois parágrafos curtos, "
    "usando SOMENTE as informações dos trechos das fontes abaixo. Indique de qual trecho veio cada "
    "informação com o número entre colchetes, por exemplo [1]. Se os trechos não trouxerem a resposta, "
    "diga claramente que as fontes não falam sobre isso. Não complete com conhecimento próprio."
)

# Cabeçalho da lista de trechos; o modo demonstração (llm.py) procura por ele.
MARCADOR_TRECHOS = "TRECHOS DAS FONTES:\n"

NADA_RELEVANTE = (
    "Não encontrei nada sobre essa pergunta nas fontes que você adicionou, então não vou responder. "
    "Confira se as fontes tratam desse assunto ou adicione outra fonte."
)


@dataclass
class TrechoUsado:
    """Um trecho escolhido pela busca: vai para o prompt e fica salvo na resposta (citação)."""

    documento: str
    pagina: int
    similaridade: float
    texto: str


def sistema_com_fontes(orientacao: str, trechos: list[TrechoUsado]) -> str:
    blocos = [SISTEMA_COM_FONTES]
    if orientacao.strip():
        blocos.append(f"ORIENTAÇÃO DO ESTUDANTE:\n{orientacao.strip()}")
    linhas = "\n".join(f"[{i}] ({t.documento}, p. {t.pagina}) {t.texto}" for i, t in enumerate(trechos, 1))
    blocos.append(f"{MARCADOR_TRECHOS}{linhas}")
    return "\n\n".join(blocos)
