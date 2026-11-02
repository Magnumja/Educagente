"""Casos de uso do Projeto: cada projeto tem pasta, índice e histórico próprios em
`data/projetos/<id>/`, e toda operação parte de um projeto já validado como do aluno."""
from dataclasses import asdict
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from educagente.erros import EntradaInvalida, NaoEncontrado, ServicoIndisponivel
from oficina.models import Aluno
from oficina.services import chave_da_pergunta
from projetos.models import Projeto, ProjetoDocumento, ProjetoResposta
from rag.engine import run
from rag.export import build_export_zip
from rag.indexacao import ArquivoIlegivel, indexar_arquivo
from rag.ingestion import FORMATOS_ACEITOS
from rag.llm import provedor_sem_chave
from rag.prompt_builder import build_prompt
from rag.schema import ProjectConfig, PromptConfig, RetrievalConfig
from rag.store import ProjectIndex

LIMITE_PROJETOS = 3
# Um modelo fixo por provedor: o aluno não digita nome de modelo.
MODELOS_POR_PROVEDOR = {"anthropic": "claude-haiku-5-5", "openai": "gpt-4o-mini", "ollama": "llama3.2:1b"}
# modo -> (usa o prompt do aluno, usa RAG)
CAMADAS = {"puro": (False, False), "prompt": (True, False), "prompt_rag": (True, True)}


def buscar_projeto(aluno: Aluno, projeto_id: int) -> Projeto:
    projeto = aluno.projetos.filter(pk=projeto_id).first()
    if projeto is None:
        raise NaoEncontrado("Projeto não encontrado")
    return projeto


def criar_projeto(aluno: Aluno, nome: str, descricao: str | None, model_provider: str, cenario_id: str | None) -> Projeto:
    if model_provider not in MODELOS_POR_PROVEDOR:
        raise EntradaInvalida(f"Provedor inválido. Use um de: {', '.join(MODELOS_POR_PROVEDOR)}.")
    if aluno.projetos.count() >= LIMITE_PROJETOS:
        raise EntradaInvalida(f"Limite de {LIMITE_PROJETOS} projetos por aluno atingido.")
    return Projeto.objects.create(
        aluno=aluno,
        nome=nome.strip(),
        descricao=descricao,
        cenario_id=cenario_id,
        model_provider=model_provider,
        model_name=MODELOS_POR_PROVEDOR[model_provider],
        embedding_model=settings.EMBEDDING_MODEL,
    )


def atualizar_projeto(projeto: Projeto, campos: dict) -> Projeto:
    """`campos` vem do schema AtualizarProjeto: só prompt e parâmetros de busca, já validados."""
    for campo, valor in campos.items():
        setattr(projeto, campo, valor)
    projeto.atualizado_em = timezone.now()
    projeto.save()
    return projeto


def pasta_do_projeto(projeto: Projeto) -> Path:
    return settings.DATA_DIR / "projetos" / str(projeto.pk)


def configuracao(projeto: Projeto) -> ProjectConfig:
    return ProjectConfig(
        project_id=str(projeto.pk),
        model_provider=projeto.model_provider,
        model_name=projeto.model_name,
        embedding_model=projeto.embedding_model,
        prompt=PromptConfig(
            persona=projeto.prompt_persona,
            context=projeto.prompt_context,
            instruction=projeto.prompt_instruction,
            restriction=projeto.prompt_restriction,
            output_format=projeto.prompt_output_format,
        ),
        retrieval=RetrievalConfig(
            chunk_max_chars=projeto.chunk_max_chars,
            chunk_overlap_chars=projeto.chunk_overlap_chars,
            top_k=projeto.top_k,
            similarity_threshold=projeto.similarity_threshold,
        ),
    )


def abrir_indice(projeto: Projeto) -> ProjectIndex:
    indice = ProjectIndex(pasta_do_projeto(projeto) / "index.jsonl", embedding_model=projeto.embedding_model)
    indice.load()
    return indice


def enviar_documento(projeto: Projeto, nome_enviado: str, conteudo: bytes) -> ProjetoDocumento:
    # Só o nome final: o nome vem do navegador e pode trazer "../" ou caminho absoluto.
    nome_arquivo = Path(nome_enviado).name
    if Path(nome_arquivo).suffix.lower() not in FORMATOS_ACEITOS:
        raise EntradaInvalida("Envie um arquivo PDF ou TXT.")

    retrieval = configuracao(projeto).retrieval
    destino = pasta_do_projeto(projeto) / "uploads" / nome_arquivo
    try:
        arquivo = indexar_arquivo(
            conteudo, destino, abrir_indice(projeto), doc_id=nome_arquivo, documento=nome_arquivo,
            chunk_max_chars=retrieval.chunk_max_chars, chunk_overlap_chars=retrieval.chunk_overlap_chars,
        )
    except ArquivoIlegivel as erro:
        raise EntradaInvalida(str(erro)) from erro
    except Exception as erro:
        raise ServicoIndisponivel(f"Falha ao gerar os embeddings no Ollama: {erro}") from erro

    documento, _ = ProjetoDocumento.objects.update_or_create(
        projeto=projeto,
        nome_arquivo=nome_arquivo,
        defaults={
            "paginas": arquivo.paginas,
            "chunk_count": len(arquivo.trechos),
            "status": "pronto" if arquivo.trechos else "sem_texto_extraido",
            "criado_em": timezone.now(),
        },
    )
    return documento


def responder(projeto: Projeto, pergunta: str, modo: str, api_key: str | None) -> ProjetoResposta:
    """Responde em uma camada e salva no histórico. A chave do aluno só vai ao provedor."""
    if provedor_sem_chave(projeto.model_provider, api_key):
        raise EntradaInvalida(
            f'Este projeto usa {projeto.model_provider}: cole sua chave na tela "Minha IA" antes de perguntar.'
        )
    usa_prompt, usa_rag = CAMADAS[modo]
    pergunta = pergunta.strip()
    try:
        resultado = run(
            configuracao(projeto), abrir_indice(projeto), pergunta,
            use_prompt=usa_prompt, use_rag=usa_rag, api_key=api_key,
        )
    except Exception as erro:
        raise ServicoIndisponivel(f"Falha ao chamar a LLM: {erro}") from erro

    return ProjetoResposta.objects.create(
        projeto=projeto,
        pergunta=pergunta,
        modo=modo,
        resposta=resultado.answer,
        trechos=[asdict(trecho) for trecho in resultado.used_chunks],
        tempo_segundos=resultado.time_seconds,
        tokens_in=resultado.tokens_in,
        tokens_out=resultado.tokens_out,
        nada_relevante=resultado.no_relevant_knowledge,
    )


def comparar(projeto: Projeto, pergunta: str, api_key: str | None) -> dict[str, ProjetoResposta]:
    return {modo: responder(projeto, pergunta, modo, api_key) for modo in CAMADAS}


def agrupar_comparacoes(projeto: Projeto) -> list[dict]:
    grupos: dict[str, dict] = {}
    for resposta in projeto.respostas.all():
        grupo = grupos.setdefault(chave_da_pergunta(resposta.pergunta), {"pergunta": resposta.pergunta, "camadas": {}})
        grupo["camadas"][resposta.modo] = resposta  # a mais recente de cada camada vence
    return sorted(grupos.values(), key=lambda grupo: -len(grupo["camadas"]))


def exportar_zip(projeto: Projeto) -> bytes:
    """Zip com config sem segredos, exemplo do prompt final e os documentos originais."""
    config = configuracao(projeto)
    config_exportada = {
        "schema_version": 1,
        "nome": projeto.nome,
        "descricao": projeto.descricao,
        "cenario_id": projeto.cenario_id,
        "model_provider": config.model_provider,
        "model_name": config.model_name,
        "embedding_model": config.embedding_model,
        "prompt": asdict(config.prompt),
        "retrieval": asdict(config.retrieval),
        "documentos": list(projeto.documentos.values("nome_arquivo", "paginas", "chunk_count", "status")),
    }
    prompt_exemplo = build_prompt(config.prompt, chunks=[], use_prompt=True, use_rag=False)
    return build_export_zip(config_exportada, prompt_exemplo, pasta_do_projeto(projeto) / "uploads", projeto.nome)
