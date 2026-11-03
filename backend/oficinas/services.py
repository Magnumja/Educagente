"""Casos de uso da oficina. As rotas só validam a entrada; tudo que é regra fica aqui.

Fluxo do participante (proposta do projeto):
  1. pergunta as três perguntas sem contexto;
  2. adiciona fontes confiáveis e, se quiser, orienta a IA;
  3. repete as mesmas perguntas, agora com as fontes, e compara as respostas.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from dataclasses import asdict

import numpy as np
from django.conf import settings
from django.core import signing
from django.db import IntegrityError, transaction

from educagente.erros import EntradaInvalida, NaoEncontrado, ServicoIndisponivel
from oficinas.models import Avaliacao, Documento, Oficina, Participante, Pergunta, Resposta, Trecho
from rag.busca import mais_parecidos
from rag.chunking import chunk_text
from rag.embeddings import embed
from rag.ingestion import FORMATOS_ACEITOS, ArquivoIlegivel, PaginaExtraida, extrair_paginas
from rag.llm import FalhaDoProvedor, build_adapter
from rag.prompts import NADA_RELEVANTE, SISTEMA_SEM_CONTEXTO, TrechoUsado, sistema_com_fontes

PERGUNTAS_POR_OFICINA = 3
MAX_PARTICIPANTES = 200
MAX_DOCUMENTOS = 6
MAX_BYTES_ARQUIVO = 5 * 1024 * 1024
MAX_CARACTERES_DOCUMENTO = 200_000
MAX_TRECHOS_NA_BASE = 600
VALIDADE_TOKEN_FACILITADOR = 12 * 60 * 60
SAL_FACILITADOR = "educagente.facilitador"


# ---------------------------------------------------------------- identidade


def hash_do_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def participante_por_token(token: str) -> Participante | None:
    if not token or len(token) > 100:
        return None
    return Participante.objects.select_related("oficina").filter(token_hash=hash_do_token(token)).first()


def oficina_por_codigo(codigo: str) -> Oficina:
    oficina = Oficina.objects.filter(codigo=codigo.strip().upper()).first()
    if oficina is None:
        raise NaoEncontrado("Não existe oficina com esse código. Confira as letras com o facilitador.")
    return oficina


def entrar(codigo: str, apelido: str, consentimento: bool) -> tuple[Participante, str]:
    if not consentimento:
        raise EntradaInvalida("Para participar, é preciso concordar com o termo.")
    apelido = " ".join(apelido.split())
    if not apelido:
        raise EntradaInvalida("Escolha um apelido.")
    oficina = oficina_por_codigo(codigo)
    if not oficina.aberta:
        raise EntradaInvalida("Esta oficina está fechada para novos participantes.")
    if oficina.participantes.count() >= MAX_PARTICIPANTES:
        raise EntradaInvalida("Esta oficina atingiu o limite de participantes.")
    token = secrets.token_urlsafe(32)
    participante = Participante.objects.create(oficina=oficina, apelido=apelido, token_hash=hash_do_token(token))
    return participante, token


def entrar_como_facilitador(senha: str) -> str:
    esperada = settings.FACILITADOR_SENHA
    if not esperada:
        raise ServicoIndisponivel("O acesso do facilitador não foi configurado (defina FACILITADOR_SENHA no .env).")
    if not hmac.compare_digest(senha.encode(), esperada.encode()):
        raise EntradaInvalida("Senha incorreta.")
    return signing.dumps({"papel": "facilitador"}, salt=SAL_FACILITADOR)


def token_de_facilitador_valido(token: str) -> bool:
    if not settings.FACILITADOR_SENHA:
        return False
    try:
        dados = signing.loads(token, salt=SAL_FACILITADOR, max_age=VALIDADE_TOKEN_FACILITADOR)
    except signing.BadSignature:
        return False
    return dados.get("papel") == "facilitador"


# ---------------------------------------------------------------- oficinas (facilitador)


def criar_oficina(titulo: str, perguntas: list[dict]) -> Oficina:
    if len(perguntas) != PERGUNTAS_POR_OFICINA:
        raise EntradaInvalida(f"A oficina precisa de exatamente {PERGUNTAS_POR_OFICINA} perguntas.")
    with transaction.atomic():
        for _ in range(5):  # colisão de código é rara; tenta outro
            try:
                with transaction.atomic():
                    oficina = Oficina.objects.create(titulo=titulo.strip())
                break
            except IntegrityError:
                continue
        else:
            raise ServicoIndisponivel("Não foi possível gerar um código. Tente de novo.")
        Pergunta.objects.bulk_create(
            Pergunta(oficina=oficina, ordem=i, texto=p["texto"].strip(), referencia=(p.get("referencia") or "").strip())
            for i, p in enumerate(perguntas, start=1)
        )
    return oficina


def buscar_oficina(oficina_id: int) -> Oficina:
    oficina = Oficina.objects.filter(pk=oficina_id).first()
    if oficina is None:
        raise NaoEncontrado("Oficina não encontrada.")
    return oficina


def atualizar_oficina(oficina: Oficina, titulo: str | None, aberta: bool | None, perguntas: list[dict] | None) -> Oficina:
    with transaction.atomic():
        if titulo is not None:
            oficina.titulo = titulo.strip()
        if aberta is not None:
            oficina.aberta = aberta
        oficina.save()
        if perguntas is not None:
            if len(perguntas) != PERGUNTAS_POR_OFICINA:
                raise EntradaInvalida(f"A oficina precisa de exatamente {PERGUNTAS_POR_OFICINA} perguntas.")
            for ordem, dados in enumerate(perguntas, start=1):
                pergunta = oficina.perguntas.get(ordem=ordem)
                novo_texto = dados["texto"].strip()
                if novo_texto != pergunta.texto and pergunta.respostas.exists():
                    raise EntradaInvalida(
                        f"A pergunta {ordem} já tem respostas: mudar o texto quebraria a comparação. Crie outra oficina."
                    )
                pergunta.texto = novo_texto
                pergunta.referencia = (dados.get("referencia") or "").strip()
                pergunta.save()
    return oficina


# ---------------------------------------------------------------- fontes e base de conhecimento


def _embed(textos: list[str]) -> np.ndarray:
    try:
        return embed(textos, provider=settings.EMBEDDING_PROVIDER, model=settings.EMBEDDING_MODEL)
    except Exception as erro:
        raise ServicoIndisponivel(
            "Não foi possível processar o texto agora (servidor de embeddings fora do ar). Avise o facilitador."
        ) from erro


def _indexar(paginas: list[PaginaExtraida], **dono) -> Documento:
    """Corta em trechos, gera os embeddings e grava tudo numa transação."""
    total = sum(len(p.texto) for p in paginas)
    if total == 0:
        raise EntradaInvalida(
            "Não achamos texto nesse arquivo. Se for um PDF escaneado (foto de página), copie e cole o texto."
        )
    if total > MAX_CARACTERES_DOCUMENTO:
        raise EntradaInvalida("Esse texto é longo demais para a oficina. Envie só o capítulo ou a parte que interessa.")

    pares = [(p.pagina, t) for p in paginas for t in chunk_text(p.texto)]
    vetores = _embed([t for _, t in pares])
    with transaction.atomic():
        documento = Documento.objects.create(paginas=len(paginas), **dono)
        Trecho.objects.bulk_create(
            Trecho(documento=documento, pagina=pagina, texto=texto, vetor=vetor.astype(np.float32).tobytes())
            for (pagina, texto), vetor in zip(pares, vetores)
        )
    return documento


def _ler_arquivo(nome: str, conteudo: bytes) -> list[PaginaExtraida]:
    if not nome.lower().endswith(FORMATOS_ACEITOS):
        raise EntradaInvalida("Envie um arquivo PDF ou TXT.")
    if len(conteudo) > MAX_BYTES_ARQUIVO:
        raise EntradaInvalida("O arquivo passa de 5 MB. Envie uma versão menor.")
    try:
        return extrair_paginas(nome, conteudo)
    except ArquivoIlegivel as erro:
        raise EntradaInvalida(str(erro)) from erro


def _nome_limpo(nome: str) -> str:
    # Só o nome final: o navegador pode mandar caminho.
    return nome.replace("\\", "/").rsplit("/", 1)[-1].strip()[:160] or "documento"


def _checar_espaco_na_base(participante: Participante) -> None:
    if participante.documentos.count() >= MAX_DOCUMENTOS:
        raise EntradaInvalida(f"Sua base já tem {MAX_DOCUMENTOS} fontes. Remova uma antes de adicionar outra.")


def _checar_tamanho_da_base(participante: Participante) -> None:
    if Trecho.objects.filter(documento__participante=participante).count() > MAX_TRECHOS_NA_BASE:
        raise EntradaInvalida("Sua base ficou grande demais para a oficina. Remova uma fonte.")


def adicionar_arquivo(participante: Participante, nome: str, conteudo: bytes) -> Documento:
    _checar_espaco_na_base(participante)
    nome = _nome_limpo(nome)
    documento = _indexar(_ler_arquivo(nome, conteudo), participante=participante, nome=nome, origem=Documento.ENVIADO)
    _checar_tamanho_da_base(participante)
    return documento


def adicionar_texto(participante: Participante, titulo: str, texto: str) -> Documento:
    _checar_espaco_na_base(participante)
    paginas = [PaginaExtraida(pagina=1, texto=texto.strip())]
    documento = _indexar(paginas, participante=participante, nome=" ".join(titulo.split())[:160], origem=Documento.COLADO)
    _checar_tamanho_da_base(participante)
    return documento


def adicionar_fonte_sugerida(participante: Participante, fonte_id: int) -> Documento:
    fonte = participante.oficina.fontes.filter(pk=fonte_id).first()
    if fonte is None:
        raise NaoEncontrado("Fonte não encontrada nesta oficina.")
    ja_tem = participante.documentos.filter(copia_de=fonte).first()
    if ja_tem:
        return ja_tem
    _checar_espaco_na_base(participante)
    # Copia os trechos já processados: nenhum embedding novo, é instantâneo.
    with transaction.atomic():
        copia = Documento.objects.create(
            participante=participante, copia_de=fonte, nome=fonte.nome, origem=Documento.SUGERIDO, paginas=fonte.paginas
        )
        Trecho.objects.bulk_create(
            Trecho(documento=copia, pagina=t.pagina, texto=t.texto, vetor=t.vetor) for t in fonte.trechos.all()
        )
    return copia


def remover_documento(participante: Participante, documento_id: int) -> None:
    apagados, _ = participante.documentos.filter(pk=documento_id).delete()
    if not apagados:
        raise NaoEncontrado("Fonte não encontrada na sua base.")


def adicionar_fonte_da_oficina(oficina: Oficina, nome: str, conteudo: bytes) -> Documento:
    if oficina.fontes.count() >= MAX_DOCUMENTOS:
        raise EntradaInvalida(f"A oficina já tem {MAX_DOCUMENTOS} fontes sugeridas.")
    nome = _nome_limpo(nome)
    return _indexar(_ler_arquivo(nome, conteudo), oficina=oficina, nome=nome, origem=Documento.SUGERIDO)


def remover_fonte_da_oficina(oficina: Oficina, fonte_id: int) -> None:
    # As cópias nas bases dos participantes continuam: o que já foi respondido segue explicável.
    apagados, _ = oficina.fontes.filter(pk=fonte_id).delete()
    if not apagados:
        raise NaoEncontrado("Fonte não encontrada.")


# ---------------------------------------------------------------- perguntas e respostas


def _buscar_trechos(participante: Participante, pergunta: str) -> list[TrechoUsado]:
    trechos = list(Trecho.objects.filter(documento__participante=participante).select_related("documento"))
    if not trechos:
        return []
    matriz = np.stack([t.vetor_np() for t in trechos])
    [consulta] = _embed([pergunta])
    achados = mais_parecidos(consulta, matriz, top_k=settings.TOP_K, limiar=settings.SIMILARITY_THRESHOLD)
    return [
        TrechoUsado(documento=trechos[i].documento.nome, pagina=trechos[i].pagina, similaridade=s, texto=trechos[i].texto)
        for i, s in achados
    ]


def perguntar(participante: Participante, pergunta_id: int, tentativa: int) -> Resposta:
    pergunta = participante.oficina.perguntas.filter(pk=pergunta_id).first()
    if pergunta is None:
        raise NaoEncontrado("Pergunta não encontrada nesta oficina.")

    inicio = time.monotonic()
    trechos: list[TrechoUsado] = []
    nada_relevante = False
    sistema = SISTEMA_SEM_CONTEXTO

    if tentativa == Resposta.COM_FONTES:
        if not participante.respostas.filter(pergunta=pergunta, tentativa=Resposta.SEM_CONTEXTO).exists():
            raise EntradaInvalida("Faça primeiro esta pergunta sem contexto (etapa 1), para poder comparar depois.")
        if not participante.documentos.exists():
            raise EntradaInvalida("Adicione pelo menos uma fonte na etapa 2 antes de perguntar de novo.")
        trechos = _buscar_trechos(participante, pergunta.texto)
        nada_relevante = not trechos
        sistema = "" if nada_relevante else sistema_com_fontes(participante.orientacao, trechos)

    if nada_relevante:
        texto = NADA_RELEVANTE
    else:
        adapter = build_adapter(settings.MODEL_PROVIDER, settings.LLM_MODEL, settings.ANTHROPIC_API_KEY)
        try:
            texto = adapter.chat(system=sistema, question=pergunta.texto).answer.strip()
        except FalhaDoProvedor as erro:
            raise ServicoIndisponivel(str(erro)) from erro
        texto = texto or "(A IA não devolveu texto. Tente de novo.)"

    resposta, _ = Resposta.objects.update_or_create(
        participante=participante,
        pergunta=pergunta,
        tentativa=tentativa,
        defaults={
            "texto": texto,
            "trechos": [asdict(t) for t in trechos],
            "nada_relevante": nada_relevante,
            "instrucoes_enviadas": sistema,
            "tempo_segundos": round(time.monotonic() - inicio, 2),
        },
    )
    return resposta


def salvar_orientacao(participante: Participante, orientacao: str) -> None:
    participante.orientacao = orientacao.strip()
    participante.save(update_fields=["orientacao"])


def avaliar(participante: Participante, pergunta_id: int, dados: dict) -> Avaliacao:
    pergunta = participante.oficina.perguntas.filter(pk=pergunta_id).first()
    if pergunta is None:
        raise NaoEncontrado("Pergunta não encontrada nesta oficina.")
    if participante.respostas.filter(pergunta=pergunta).count() < 2:
        raise EntradaInvalida("Responda esta pergunta nas duas tentativas antes de avaliar.")
    avaliacao, _ = Avaliacao.objects.update_or_create(participante=participante, pergunta=pergunta, defaults=dados)
    return avaliacao


# ---------------------------------------------------------------- relatório do facilitador


def relatorio(oficina: Oficina) -> dict:
    perguntas = list(oficina.perguntas.all())
    participantes = list(oficina.participantes.prefetch_related("respostas", "avaliacoes", "documentos"))
    linhas = []
    for p in participantes:
        respostas = {(r.pergunta_id, r.tentativa): r for r in p.respostas.all()}
        avaliacoes = {a.pergunta_id: a for a in p.avaliacoes.all()}
        linhas.append(
            {
                "id": p.pk,
                "apelido": p.apelido,
                "criado_em": p.criado_em,
                "fontes": [d.nome for d in p.documentos.all()],
                "orientacao": p.orientacao,
                "perguntas": [
                    {
                        "pergunta_id": q.pk,
                        "primeira": respostas.get((q.pk, 1)),
                        "segunda": respostas.get((q.pk, 2)),
                        "avaliacao": avaliacoes.get(q.pk),
                    }
                    for q in perguntas
                ],
            }
        )
    return {"oficina": oficina, "perguntas": perguntas, "participantes": linhas}


def apagar_participante(oficina: Oficina, participante_id: int) -> None:
    apagados, _ = oficina.participantes.filter(pk=participante_id).delete()
    if not apagados:
        raise NaoEncontrado("Participante não encontrado.")
