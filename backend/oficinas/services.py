"""Casos de uso da oficina: todas as regras do sistema ficam aqui.

As rotas (`oficinas/api.py`) só validam o formato da entrada e chamam uma função
deste arquivo. Cada função recebe objetos já autenticados (o `Participante` ou a
`Oficina`), aplica as regras, grava no banco e devolve objetos do banco, que os schemas
transformam em JSON. Quando algo não pode ser feito, levanta um erro de
`educagente/erros.py` com a mensagem que o participante vai ler.

Fluxo do participante (proposta do projeto):
  1. pergunta as três perguntas sem contexto;
  2. adiciona fontes confiáveis e, se quiser, orienta a IA;
  3. repete as mesmas perguntas, agora com as fontes, e compara as respostas.

É aqui que as etapas do núcleo `rag/` se juntam: extração, corte em trechos e embeddings
ao adicionar uma fonte; embeddings, busca, prompt e modelo de chat ao perguntar.
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
from django.db.models import Count
from django.utils import timezone

from educagente.erros import EntradaInvalida, NaoEncontrado, ServicoIndisponivel
from oficinas.models import Avaliacao, Documento, Oficina, Participante, Pergunta, Resposta, Trecho
from rag.busca import mais_parecidos
from rag.chunking import dividir_em_trechos
from rag.embeddings import gerar_embeddings
from rag.ingestion import FORMATOS_ACEITOS, ArquivoIlegivel, PaginaExtraida, extrair_paginas
from rag.llm import FalhaDoProvedor, criar_adaptador
from rag.prompts import NADA_RELEVANTE, SISTEMA_SEM_CONTEXTO, TrechoUsado, sistema_com_fontes

# Limites da oficina: protegem o servidor (CPU do Ollama, tamanho do SQLite) numa turma inteira.
PERGUNTAS_POR_OFICINA = 3
MAX_PARTICIPANTES = 200
MAX_DOCUMENTOS = 6
MAX_BYTES_ARQUIVO = 5 * 1024 * 1024
MAX_CARACTERES_DOCUMENTO = 200_000
MAX_TRECHOS_NA_BASE = 600
TENTATIVAS_DE_CODIGO = 5
VALIDADE_TOKEN_FACILITADOR = 12 * 60 * 60  # 12 horas, em segundos: cobre um dia de oficina
SAL_FACILITADOR = "educagente.facilitador"


# ---------------------------------------------------------------- identidade (quem é quem)


def hash_do_token(token: str) -> str:
    # O banco guarda só o hash: quem copiar o arquivo do banco não consegue se passar por ninguém.
    return hashlib.sha256(token.encode()).hexdigest()


def participante_por_token(token: str) -> Participante | None:
    """Usado pela autenticação das rotas `/eu`: None vira 401."""
    if not token or len(token) > 100:
        return None
    return Participante.objects.select_related("oficina").filter(token_hash=hash_do_token(token)).first()


def oficina_por_codigo(codigo: str) -> Oficina:
    oficina = Oficina.objects.filter(codigo=codigo.strip().upper()).first()
    if oficina is None:
        raise NaoEncontrado("Não existe oficina com esse código. Confira as letras com o facilitador.")
    return oficina


def entrar(codigo: str, apelido: str, consentimento: bool) -> tuple[Participante, str]:
    """Cria o participante e devolve o token, que só existe em texto puro nesta resposta."""
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


def apagar_meus_dados(participante: Participante) -> None:
    """LGPD: apaga o participante e, em cascata, as fontes, trechos, respostas e avaliações dele."""
    participante.delete()


def entrar_como_facilitador(senha: str) -> str:
    """Confere a senha do .env e devolve um token assinado (sem tabela de sessões)."""
    esperada = settings.FACILITADOR_SENHA
    if not esperada:
        raise ServicoIndisponivel("O acesso do facilitador não foi configurado (defina FACILITADOR_SENHA no .env).")
    # compare_digest leva o mesmo tempo acerte ou erre: não dá para adivinhar a senha pelo tempo de resposta.
    if not hmac.compare_digest(senha.encode(), esperada.encode()):
        raise EntradaInvalida("Senha incorreta.")
    return signing.dumps({"papel": "facilitador"}, salt=SAL_FACILITADOR)


def token_de_facilitador_valido(token: str) -> bool:
    if not settings.FACILITADOR_SENHA:
        return False
    try:
        dados = signing.loads(token, salt=SAL_FACILITADOR, max_age=VALIDADE_TOKEN_FACILITADOR)
    except signing.BadSignature:  # inclui o token expirado
        return False
    return dados.get("papel") == "facilitador"


# ---------------------------------------------------------------- oficinas (facilitador)


def listar_oficinas() -> list[Oficina]:
    return list(Oficina.objects.annotate(total_participantes=Count("participantes")))


def buscar_oficina(oficina_id: int) -> Oficina:
    oficina = Oficina.objects.filter(pk=oficina_id).first()
    if oficina is None:
        raise NaoEncontrado("Oficina não encontrada.")
    return oficina


def criar_oficina(titulo: str, perguntas: list[dict]) -> Oficina:
    _exigir_tres_perguntas(perguntas)
    with transaction.atomic():
        oficina = _criar_com_codigo_unico(titulo.strip())
        Pergunta.objects.bulk_create(
            Pergunta(oficina=oficina, ordem=ordem, texto=dados["texto"].strip(), referencia=_referencia(dados))
            for ordem, dados in enumerate(perguntas, start=1)
        )
    return oficina


def atualizar_oficina(oficina: Oficina, titulo: str | None, aberta: bool | None, perguntas: list[dict] | None) -> Oficina:
    """Muda só o que veio preenchido (None = manter)."""
    with transaction.atomic():
        if titulo is not None:
            oficina.titulo = titulo.strip()
        if aberta is not None:
            oficina.aberta = aberta
        oficina.save()
        if perguntas is not None:
            _atualizar_perguntas(oficina, perguntas)
    return oficina


def apagar_oficina(oficina: Oficina) -> None:
    oficina.delete()  # em cascata: perguntas, fontes, participantes e tudo deles


def _exigir_tres_perguntas(perguntas: list[dict]) -> None:
    if len(perguntas) != PERGUNTAS_POR_OFICINA:
        raise EntradaInvalida(f"A oficina precisa de exatamente {PERGUNTAS_POR_OFICINA} perguntas.")


def _referencia(dados: dict) -> str:
    return (dados.get("referencia") or "").strip()


def _criar_com_codigo_unico(titulo: str) -> Oficina:
    """O código é sorteado no model; se colidir com um existente (raro), sorteia de novo."""
    for _ in range(TENTATIVAS_DE_CODIGO):
        try:
            # Savepoint: a falha de um INSERT não estraga a transação de fora.
            with transaction.atomic():
                return Oficina.objects.create(titulo=titulo)
        except IntegrityError:
            continue
    raise ServicoIndisponivel("Não foi possível gerar um código. Tente de novo.")


def _atualizar_perguntas(oficina: Oficina, perguntas: list[dict]) -> None:
    _exigir_tres_perguntas(perguntas)
    for ordem, dados in enumerate(perguntas, start=1):
        pergunta = oficina.perguntas.get(ordem=ordem)
        novo_texto = dados["texto"].strip()
        if novo_texto != pergunta.texto and pergunta.respostas.exists():
            raise EntradaInvalida(
                f"A pergunta {ordem} já tem respostas: mudar o texto quebraria a comparação. Crie outra oficina."
            )
        pergunta.texto = novo_texto
        pergunta.referencia = _referencia(dados)
        pergunta.save()


# ---------------------------------------------------------------- fontes e base de conhecimento


def exigir_tamanho_maximo(tamanho_em_bytes: int) -> None:
    """Também chamada pela rota antes de ler o upload, para não carregar um arquivo enorme na memória."""
    if tamanho_em_bytes > MAX_BYTES_ARQUIVO:
        raise EntradaInvalida("O arquivo passa de 5 MB. Envie uma versão menor.")


def adicionar_arquivo(participante: Participante, nome: str, conteudo: bytes) -> Documento:
    _checar_espaco_na_base(participante)
    nome = _nome_limpo(nome)
    paginas = _ler_arquivo(nome, conteudo)
    return _indexar_na_base(participante, paginas, nome=nome, origem=Documento.ENVIADO)


def adicionar_texto(participante: Participante, titulo: str, texto: str) -> Documento:
    _checar_espaco_na_base(participante)
    paginas = [PaginaExtraida(pagina=1, texto=texto.strip())]
    nome = " ".join(titulo.split())[:160]
    return _indexar_na_base(participante, paginas, nome=nome, origem=Documento.COLADO)


def adicionar_fonte_sugerida(participante: Participante, fonte_id: int) -> Documento:
    """Copia uma fonte do facilitador para a base do participante (só uma vez)."""
    fonte = participante.oficina.fontes.filter(pk=fonte_id).first()
    if fonte is None:
        raise NaoEncontrado("Fonte não encontrada nesta oficina.")
    ja_copiada = participante.documentos.filter(copia_de=fonte).first()
    if ja_copiada:
        return ja_copiada
    _checar_espaco_na_base(participante)
    _exigir_espaco_para_trechos(participante, fonte.trechos.count())
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
    # Filtrar pela base do participante impede apagar a fonte de outra pessoa (vira 404).
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


def _ler_arquivo(nome: str, conteudo: bytes) -> list[PaginaExtraida]:
    """Etapa 1 do RAG (extração), traduzindo a falha de leitura para uma mensagem ao participante."""
    if not nome.lower().endswith(FORMATOS_ACEITOS):
        raise EntradaInvalida("Envie um arquivo PDF ou TXT.")
    exigir_tamanho_maximo(len(conteudo))
    try:
        return extrair_paginas(nome, conteudo)
    except ArquivoIlegivel as erro:
        raise EntradaInvalida(str(erro)) from erro


def _nome_limpo(nome: str) -> str:
    # Só o nome final: o navegador pode mandar o caminho inteiro (C:\Users\...\arquivo.pdf).
    return nome.replace("\\", "/").rsplit("/", 1)[-1].strip()[:160] or "documento"


def _checar_espaco_na_base(participante: Participante) -> None:
    if participante.documentos.count() >= MAX_DOCUMENTOS:
        raise EntradaInvalida(f"Sua base já tem {MAX_DOCUMENTOS} fontes. Remova uma antes de adicionar outra.")


def _exigir_espaco_para_trechos(participante: Participante, novos: int) -> None:
    # Conferido ANTES de gravar: se a base estouraria, nada é salvo.
    atuais = Trecho.objects.filter(documento__participante=participante).count()
    if atuais + novos > MAX_TRECHOS_NA_BASE:
        raise EntradaInvalida("Essa fonte deixaria sua base grande demais para a oficina. Remova uma fonte ou envie um trecho menor.")


def _indexar_na_base(participante: Participante, paginas: list[PaginaExtraida], nome: str, origem: str) -> Documento:
    trechos = _cortar_em_trechos(paginas)
    _exigir_espaco_para_trechos(participante, len(trechos))
    return _gravar_documento(trechos, participante=participante, nome=nome, origem=origem, paginas=len(paginas))


def _indexar(paginas: list[PaginaExtraida], **campos_do_documento) -> Documento:
    """Etapas 2 e 3 do RAG para uma fonte da oficina: corta em trechos e grava com os embeddings."""
    return _gravar_documento(_cortar_em_trechos(paginas), paginas=len(paginas), **campos_do_documento)


def _cortar_em_trechos(paginas: list[PaginaExtraida]) -> list[tuple[int, str]]:
    """Etapa 2 do RAG: (página, texto) de cada trecho, depois de conferir se o texto serve."""
    total = sum(len(p.texto) for p in paginas)
    if total == 0:
        raise EntradaInvalida(
            "Não achamos texto nesse arquivo. Se for um PDF escaneado (foto de página), copie e cole o texto."
        )
    if total > MAX_CARACTERES_DOCUMENTO:
        raise EntradaInvalida("Esse texto é longo demais para a oficina. Envie só o capítulo ou a parte que interessa.")
    return [(p.pagina, texto) for p in paginas for texto in dividir_em_trechos(p.texto)]


def _gravar_documento(trechos: list[tuple[int, str]], **campos_do_documento) -> Documento:
    """Etapa 3 do RAG: gera os embeddings e grava documento e trechos numa transação só."""
    vetores = _gerar_embeddings([texto for _, texto in trechos])
    with transaction.atomic():
        documento = Documento.objects.create(**campos_do_documento)
        Trecho.objects.bulk_create(
            Trecho(documento=documento, pagina=pagina, texto=texto, vetor=vetor.astype(np.float32).tobytes())
            for (pagina, texto), vetor in zip(trechos, vetores)
        )
    return documento


def _gerar_embeddings(textos: list[str]) -> np.ndarray:
    try:
        return gerar_embeddings(textos, provedor=settings.EMBEDDING_PROVIDER, modelo=settings.EMBEDDING_MODEL)
    except Exception as erro:
        raise ServicoIndisponivel(
            "Não foi possível processar o texto agora (servidor de embeddings fora do ar). Avise o facilitador."
        ) from erro


# ---------------------------------------------------------------- perguntas e respostas


def perguntar(participante: Participante, pergunta_id: int, tentativa: int) -> Resposta:
    """O coração da oficina: tentativa 1 vai sem contexto; tentativa 2 vai com os trechos da base."""
    pergunta = _pergunta_da_oficina(participante, pergunta_id)
    inicio = time.monotonic()

    trechos: list[TrechoUsado] = []
    sistema = SISTEMA_SEM_CONTEXTO
    if tentativa == Resposta.COM_FONTES:
        _exigir_pre_requisitos_da_segunda_tentativa(participante, pergunta)
        trechos = _buscar_trechos(participante, pergunta.texto)
        sistema = sistema_com_fontes(participante.orientacao, trechos) if trechos else ""
    nada_relevante = tentativa == Resposta.COM_FONTES and not trechos

    # Sem trecho relevante a IA nem é chamada: assim ela não tem como inventar.
    texto = NADA_RELEVANTE if nada_relevante else _consultar_modelo(sistema, pergunta.texto)

    # Repetir a pergunta substitui a resposta anterior daquela tentativa.
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
    """Grava (ou substitui) a avaliação; a partir daqui a referência do facilitador aparece."""
    pergunta = _pergunta_da_oficina(participante, pergunta_id)
    if participante.respostas.filter(pergunta=pergunta).count() < 2:
        raise EntradaInvalida("Responda esta pergunta nas duas tentativas antes de avaliar.")
    avaliacao, _ = Avaliacao.objects.update_or_create(
        participante=participante, pergunta=pergunta, defaults=dados | {"atualizado_em": timezone.now()}
    )
    return avaliacao


def _pergunta_da_oficina(participante: Participante, pergunta_id: int) -> Pergunta:
    # Procurar só na oficina do participante impede usar a pergunta de outra oficina (vira 404).
    pergunta = participante.oficina.perguntas.filter(pk=pergunta_id).first()
    if pergunta is None:
        raise NaoEncontrado("Pergunta não encontrada nesta oficina.")
    return pergunta


def _exigir_pre_requisitos_da_segunda_tentativa(participante: Participante, pergunta: Pergunta) -> None:
    if not participante.respostas.filter(pergunta=pergunta, tentativa=Resposta.SEM_CONTEXTO).exists():
        raise EntradaInvalida("Faça primeiro esta pergunta sem contexto (etapa 1), para poder comparar depois.")
    if not participante.documentos.exists():
        raise EntradaInvalida("Adicione pelo menos uma fonte na etapa 2 antes de perguntar de novo.")


def _buscar_trechos(participante: Participante, pergunta: str) -> list[TrechoUsado]:
    """Etapas 3 e 4 do RAG: embedding da pergunta e busca por cosseno na base do participante."""
    trechos = list(Trecho.objects.filter(documento__participante=participante).select_related("documento"))
    if not trechos:
        return []
    matriz = np.stack([t.vetor_np() for t in trechos])
    [consulta] = _gerar_embeddings([pergunta])
    achados = mais_parecidos(consulta, matriz, top_k=settings.TOP_K, limiar=settings.SIMILARITY_THRESHOLD)
    return [
        TrechoUsado(documento=trechos[i].documento.nome, pagina=trechos[i].pagina, similaridade=s, texto=trechos[i].texto)
        for i, s in achados
    ]


def _consultar_modelo(sistema: str, pergunta: str) -> str:
    """Etapa 6 do RAG: envia ao modelo configurado pela equipe no .env."""
    adaptador = criar_adaptador(settings.MODEL_PROVIDER, settings.LLM_MODEL, settings.ANTHROPIC_API_KEY)
    try:
        texto = adaptador.conversar(sistema=sistema, pergunta=pergunta).texto.strip()
    except FalhaDoProvedor as erro:
        raise ServicoIndisponivel(str(erro)) from erro
    return texto or "(A IA não devolveu texto. Tente de novo.)"


# ---------------------------------------------------------------- telas: participante e facilitador


def estado_do_participante(participante: Participante) -> dict:
    """Tudo que a tela do participante mostra (formato de `schemas.EstadoOut`)."""
    oficina = participante.oficina
    perguntas = list(oficina.perguntas.all())
    avaliadas = set(participante.avaliacoes.values_list("pergunta_id", flat=True))
    return {
        "id": participante.pk,
        "apelido": participante.apelido,
        "orientacao": participante.orientacao,
        "oficina": oficina,
        "perguntas": perguntas,
        "fontes_sugeridas": list(oficina.fontes.all()),
        "documentos": list(participante.documentos.all()),
        "respostas": list(participante.respostas.all()),
        "avaliacoes": list(participante.avaliacoes.all()),
        # A referência do facilitador só aparece depois que o participante avaliou sozinho.
        "referencias": {q.pk: q.referencia for q in perguntas if q.pk in avaliadas and q.referencia},
    }


def detalhe_da_oficina(oficina: Oficina) -> dict:
    """Painel do facilitador para uma oficina (formato de `schemas.OficinaDetalheOut`)."""
    dados = relatorio(oficina)
    return {
        "id": oficina.pk,
        "titulo": oficina.titulo,
        "codigo": oficina.codigo,
        "aberta": oficina.aberta,
        "criado_em": oficina.criado_em,
        "total_participantes": len(dados["participantes"]),
        "perguntas": dados["perguntas"],
        "fontes": list(oficina.fontes.all()),
        "relatorio": dados["participantes"],
    }


def relatorio(oficina: Oficina) -> dict:
    """Para cada participante, as duas respostas e a avaliação de cada pergunta.

    Usado pelo painel (`detalhe_da_oficina`) e pela planilha (`exportacao.py`).
    """
    perguntas = list(oficina.perguntas.all())
    participantes = oficina.participantes.prefetch_related("respostas", "avaliacoes", "documentos")
    return {"perguntas": perguntas, "participantes": [_linha_do_relatorio(p, perguntas) for p in participantes]}


def _linha_do_relatorio(participante: Participante, perguntas: list[Pergunta]) -> dict:
    respostas = {(r.pergunta_id, r.tentativa): r for r in participante.respostas.all()}
    avaliacoes = {a.pergunta_id: a for a in participante.avaliacoes.all()}
    return {
        "id": participante.pk,
        "apelido": participante.apelido,
        "criado_em": participante.criado_em,
        "fontes": [d.nome for d in participante.documentos.all()],
        "orientacao": participante.orientacao,
        "perguntas": [
            {
                "pergunta_id": q.pk,
                "primeira": respostas.get((q.pk, Resposta.SEM_CONTEXTO)),
                "segunda": respostas.get((q.pk, Resposta.COM_FONTES)),
                "avaliacao": avaliacoes.get(q.pk),
            }
            for q in perguntas
        ],
    }


def apagar_participante(oficina: Oficina, participante_id: int) -> None:
    apagados, _ = oficina.participantes.filter(pk=participante_id).delete()
    if not apagados:
        raise NaoEncontrado("Participante não encontrado.")
