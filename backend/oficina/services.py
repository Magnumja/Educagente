"""Casos de uso da Oficina RAG: a mesma pergunta em três etapas (sem RAG, documento errado,
documento real), com um índice por aluno e etapa."""
from dataclasses import asdict
from pathlib import Path

from django.conf import settings

from educagente.erros import EntradaInvalida, NaoEncontrado, ServicoIndisponivel
from oficina.models import Aluno, Resposta
from rag.engine import run
from rag.indexacao import ArquivoIlegivel, indexar_arquivo
from rag.ingestion import FORMATOS_ACEITOS
from rag.schema import EngineResult, ProjectConfig, PromptConfig, RetrievalConfig
from rag.store import ProjectIndex

SYSTEM_LIVRE = (
    "Você é um assistente conversando com estudantes do Ensino Médio. Responda em português, "
    "de forma curta e direta."
)
SYSTEM_RAG_INSTRUCAO = (
    "Você é um assistente conversando com estudantes do Ensino Médio. Responda em português, "
    "de forma curta e direta, usando SOMENTE as informações dos trechos da base de "
    "conhecimento abaixo. Cite o número do trecho entre colchetes, por exemplo [1]. "
    "Se os trechos não tiverem a resposta, diga que não encontrou nos dados."
)
ETAPAS_COM_DOCUMENTO = (2, 3)


def chave_da_pergunta(pergunta: str) -> str:
    """Agrupa a mesma pergunta ignorando maiúsculas, espaços e pontuação final."""
    return " ".join(pergunta.lower().split()).rstrip("?!. ")


def buscar_aluno(aluno_id: int) -> Aluno:
    aluno = Aluno.objects.filter(pk=aluno_id).first()
    if aluno is None:
        raise NaoEncontrado("Aluno não encontrado")
    return aluno


def criar_aluno(apelido: str, turma: str | None, consentimento: bool) -> Aluno:
    if not consentimento:
        raise EntradaInvalida("É preciso aceitar o termo de consentimento.")
    return Aluno.objects.create(apelido=apelido.strip(), turma=(turma or "").strip() or None, consentimento=True)


def abrir_indice(aluno_id: int, etapa: int) -> ProjectIndex:
    caminho = settings.DATA_DIR / "indices" / f"aluno{aluno_id}_etapa{etapa}.jsonl"
    indice = ProjectIndex(caminho, embedding_model=settings.EMBEDDING_MODEL)
    indice.load()
    return indice


def contar_trechos(aluno: Aluno) -> dict[int, int]:
    return {etapa: abrir_indice(aluno.pk, etapa).count() for etapa in ETAPAS_COM_DOCUMENTO}


def enviar_documento(aluno: Aluno, etapa: int, nome_arquivo: str, conteudo: bytes) -> list[str]:
    """Indexa o documento da etapa (substitui o anterior) e devolve os trechos gerados."""
    if etapa not in ETAPAS_COM_DOCUMENTO:
        raise EntradaInvalida("Etapa inválida (use 2 ou 3).")
    sufixo = Path(nome_arquivo).suffix.lower()
    if sufixo not in FORMATOS_ACEITOS:
        raise EntradaInvalida("Envie um arquivo PDF ou TXT.")

    destino = settings.DATA_DIR / "uploads" / f"aluno{aluno.pk}_etapa{etapa}{sufixo}"
    try:
        arquivo = indexar_arquivo(
            conteudo, destino, abrir_indice(aluno.pk, etapa), doc_id="documento", documento=nome_arquivo
        )
    except ArquivoIlegivel as erro:
        raise EntradaInvalida(str(erro)) from erro
    except Exception as erro:
        raise ServicoIndisponivel(f"Falha ao gerar os embeddings no Ollama: {erro}") from erro

    if not arquivo.trechos:
        raise EntradaInvalida("Não foi possível extrair texto do arquivo enviado.")
    return arquivo.trechos


def perguntar(aluno: Aluno, etapa: int, pergunta: str) -> tuple[Resposta, EngineResult]:
    """Responde e salva. O resultado completo volta junto porque tempo e "nada relevante"
    aparecem na tela, mas não são guardados no histórico da Oficina."""
    pergunta = pergunta.strip()
    usa_rag = etapa in ETAPAS_COM_DOCUMENTO
    indice = None
    if usa_rag:
        indice = abrir_indice(aluno.pk, etapa)
        if indice.count() == 0:
            raise EntradaInvalida(f"Envie o documento da etapa {etapa} antes de perguntar.")

    config = ProjectConfig(
        project_id=f"aluno{aluno.pk}",
        model_provider=settings.MODEL_PROVIDER,
        model_name=settings.LLM_MODEL,
        embedding_model=settings.EMBEDDING_MODEL,
        prompt=PromptConfig(persona=SYSTEM_RAG_INSTRUCAO if usa_rag else SYSTEM_LIVRE),
        retrieval=RetrievalConfig(top_k=settings.TOP_K, similarity_threshold=settings.SIMILARITY_THRESHOLD),
    )
    try:
        resultado = run(config, indice, pergunta, use_prompt=True, use_rag=usa_rag)
    except Exception as erro:
        raise ServicoIndisponivel(f"Falha ao chamar a LLM: {erro}") from erro

    resposta = Resposta.objects.create(
        aluno=aluno,
        etapa=etapa,
        pergunta=pergunta,
        resposta=resultado.answer,
        trechos=[asdict(trecho) for trecho in resultado.used_chunks],
    )
    return resposta, resultado
