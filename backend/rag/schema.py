"""Modelos de dados do núcleo RAG: configuração do projeto e resultado da pergunta."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class UsedChunk:
    documento: str
    pagina: int
    similaridade: float
    texto: str


@dataclass
class EngineResult:
    answer: str
    final_prompt_sent: str
    used_chunks: list[UsedChunk]
    time_seconds: float
    tokens_in: int
    tokens_out: int
    no_relevant_knowledge: bool


@dataclass
class PromptConfig:
    persona: str = ""
    context: str = ""
    instruction: str = ""
    restriction: str = ""
    output_format: str = ""


@dataclass
class RetrievalConfig:
    chunk_max_chars: int = 600
    chunk_overlap_chars: int = 80
    top_k: int = 4
    similarity_threshold: float = 0.5


@dataclass
class ProjectConfig:
    project_id: str
    model_provider: str  # "ollama" | "anthropic" | "openai" | "demo"
    model_name: str
    embedding_model: str = "bge-m3"
    prompt: PromptConfig = field(default_factory=PromptConfig)
    retrieval: RetrievalConfig = field(default_factory=RetrievalConfig)
