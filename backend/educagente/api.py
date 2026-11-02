from django.conf import settings
from ninja import Field, NinjaAPI, Schema

from educagente.erros import EntradaInvalida, NaoEncontrado, ServicoIndisponivel
from oficina.api import router as oficina_router
from projetos.api import router as projetos_router
from rag.llm import provedor_sem_chave

api = NinjaAPI(title="Educagente")
api.add_router("", oficina_router)
api.add_router("", projetos_router)

STATUS_POR_ERRO = {NaoEncontrado: 404, EntradaInvalida: 400, ServicoIndisponivel: 502}


def responder_erro(request, erro: Exception):
    return api.create_response(request, {"detail": str(erro)}, status=STATUS_POR_ERRO[type(erro)])


for tipo_de_erro in STATUS_POR_ERRO:
    api.add_exception_handler(tipo_de_erro, responder_erro)


@api.get("/saude")
def saude(request):
    provedor = settings.MODEL_PROVIDER
    modo_demonstracao = provedor == "demo" or provedor_sem_chave(provedor)
    return {
        "ok": True,
        "provedor": provedor,
        "modelo": settings.LLM_MODEL,
        "llm_configurada": not modo_demonstracao,
    }


class ValidarChave(Schema):
    provider: str = Field(pattern="^(anthropic|openai)$")
    api_key: str = Field(min_length=1, max_length=400)


@api.post("/validar-chave")
def validar_chave(request, dados: ValidarChave):
    """Testa a chave com uma chamada que não gasta tokens (lista de modelos) e a descarta."""
    try:
        if dados.provider == "anthropic":
            import anthropic

            anthropic.Anthropic(api_key=dados.api_key).models.list(limit=1)
        else:
            import openai

            openai.OpenAI(api_key=dados.api_key).models.list()
    except Exception as erro:
        return {"ok": False, "erro": str(erro)}
    return {"ok": True}
