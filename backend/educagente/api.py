"""Monta a API única do projeto (NinjaAPI), servida em `/api/` por `educagente/urls.py`.

- junta os três grupos de rotas de `oficinas/api.py` (público, participante, facilitador);
- converte os erros dos casos de uso (`educagente/erros.py`) em status HTTP com
  `{"detail": "mensagem"}`, que o frontend mostra ao participante;
- expõe `/api/saude`, que a tela inicial consulta para saber o modo do servidor.

A documentação interativa (`/api/docs`) só existe com DJANGO_DEBUG=1.
"""
from django.conf import settings
from ninja import NinjaAPI

from educagente.erros import EntradaInvalida, NaoEncontrado, ServicoIndisponivel
from oficinas.api import facilitador, participante, publico
from rag.llm import modo_demonstracao

api = NinjaAPI(title="Educagente", docs_url="/docs" if settings.DEBUG else None)
api.add_router("", publico)
api.add_router("", participante)
api.add_router("", facilitador)

STATUS_POR_ERRO = {NaoEncontrado: 404, EntradaInvalida: 400, ServicoIndisponivel: 503}


def responder_erro(request, erro: Exception):
    return api.create_response(request, {"detail": str(erro)}, status=STATUS_POR_ERRO[type(erro)])


for tipo_de_erro in STATUS_POR_ERRO:
    api.add_exception_handler(tipo_de_erro, responder_erro)


@api.get("/saude", tags=["público"])
def saude(request):
    demonstracao = modo_demonstracao(settings.MODEL_PROVIDER, settings.ANTHROPIC_API_KEY)
    return {
        "ok": True,
        "modelo": None if demonstracao else settings.LLM_MODEL,
        "demonstracao": demonstracao,
        "embeddings_locais": settings.EMBEDDING_PROVIDER == "local",
        "facilitador_configurado": bool(settings.FACILITADOR_SENHA),
    }
