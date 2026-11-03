from django.conf import settings
from ninja import NinjaAPI

from educagente.erros import EntradaInvalida, NaoEncontrado, ServicoIndisponivel
from oficinas.api import facilitador, participante, publico

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
    demonstracao = settings.MODEL_PROVIDER == "demo" or (
        settings.MODEL_PROVIDER == "anthropic" and not settings.ANTHROPIC_API_KEY
    )
    return {
        "ok": True,
        "modelo": settings.LLM_MODEL if not demonstracao else None,
        "demonstracao": demonstracao,
        "embeddings_locais": settings.EMBEDDING_PROVIDER == "local",
        "facilitador_configurado": bool(settings.FACILITADOR_SENHA),
    }
