"""Rotas HTTP da oficina (Django Ninja), montadas em `/api/` por `educagente/api.py`.

Cada rota faz só três coisas: identifica quem chama (autenticação), valida o formato
do pedido (schemas de `oficinas/schemas.py`) e chama um caso de uso de
`oficinas/services.py`. Nenhuma regra mora aqui.

Três grupos, com três níveis de acesso:
- `publico`: ver uma oficina pelo código, entrar como participante, entrar como facilitador;
- `participante` (`/eu/...`): exige o cabeçalho `X-Participante: <token>`;
- `facilitador` (`/facilitador/...`): exige `Authorization: Bearer <token>`.

Os limites de uso (throttle) seguram abuso e protegem a IA, que é o recurso mais caro.
"""
from django.http import HttpResponse
from django.utils.http import content_disposition_header
from ninja import File, Router, UploadedFile
from ninja.security import APIKeyHeader, HttpBearer
from ninja.throttling import AnonRateThrottle, AuthRateThrottle

from oficinas import exportacao, services
from oficinas.schemas import (
    AtualizarOficinaIn,
    AvaliacaoIn,
    AvaliacaoOut,
    BuscaOut,
    DocumentoOut,
    EntrarIn,
    EntrarOut,
    EstadoOut,
    NovaOficinaIn,
    OficinaDetalheOut,
    OficinaOut,
    OficinaResumoOut,
    OrientacaoIn,
    PerguntarIn,
    RespostaOut,
    SenhaIn,
    TextoIn,
)

# ---------------------------------------------------------------- autenticação


class TokenDoParticipante(APIKeyHeader):
    """Lê o cabeçalho X-Participante; o participante achado fica em `request.auth`."""

    param_name = "X-Participante"

    def authenticate(self, request, key):
        return services.participante_por_token(key or "")


class TokenDoFacilitador(HttpBearer):
    """Lê `Authorization: Bearer ...`; None (token inválido ou vencido) vira 401."""

    def authenticate(self, request, token):
        return services.token_de_facilitador_valido(token) or None


publico = Router(tags=["público"])
participante = Router(tags=["participante"], auth=TokenDoParticipante())
facilitador = Router(tags=["facilitador"], auth=TokenDoFacilitador())


def ler_upload(arquivo: UploadedFile) -> bytes:
    # Confere o tamanho declarado antes de ler, para não carregar um arquivo enorme na memória.
    services.exigir_tamanho_maximo(arquivo.size or 0)
    return arquivo.read()


# ---------------------------------------------------------------- público


@publico.get("/oficinas/{codigo}", response=OficinaResumoOut)
def ver_oficina(request, codigo: str):
    return services.oficina_por_codigo(codigo)


@publico.post("/oficinas/{codigo}/entrar", response=EntrarOut, throttle=[AnonRateThrottle("120/m")])
def entrar(request, codigo: str, dados: EntrarIn):
    # Limite alto: a turma toda entra no mesmo minuto, e a rede da escola pode sair por um IP só.
    novo, token = services.entrar(codigo, dados.apelido, dados.consentimento)
    return {"token": token, "estado": services.estado_do_participante(novo)}


@publico.post("/facilitador/entrar", throttle=[AnonRateThrottle("5/m")])
def entrar_facilitador(request, dados: SenhaIn):
    # Limite baixo: dificulta tentar senhas no chute.
    return {"token": services.entrar_como_facilitador(dados.senha)}


# ---------------------------------------------------------------- participante


@participante.get("/eu", response=EstadoOut)
def ver_estado(request):
    return services.estado_do_participante(request.auth)


@participante.delete("/eu", response={204: None})
def sair_e_apagar(request):
    """LGPD: o participante apaga tudo o que enviou e respondeu."""
    services.apagar_meus_dados(request.auth)
    return 204, None


@participante.post("/eu/perguntar", response=RespostaOut, throttle=[AuthRateThrottle("15/m")])
def perguntar(request, dados: PerguntarIn):
    return services.perguntar(request.auth, dados.pergunta_id, dados.tentativa)


@participante.get("/eu/perguntas/{pergunta_id}/busca", response=BuscaOut, throttle=[AuthRateThrottle("30/m")])
def ver_busca(request, pergunta_id: int):
    """Para o esquema da etapa 3: como cada trecho da base se saiu nesta pergunta."""
    return services.busca_da_pergunta(request.auth, pergunta_id)


@participante.post("/eu/documentos", response=DocumentoOut, throttle=[AuthRateThrottle("10/m")])
def enviar_documento(request, arquivo: UploadedFile = File(...)):
    return services.adicionar_arquivo(request.auth, arquivo.name or "", ler_upload(arquivo))


@participante.post("/eu/textos", response=DocumentoOut, throttle=[AuthRateThrottle("10/m")])
def colar_texto(request, dados: TextoIn):
    return services.adicionar_texto(request.auth, dados.titulo, dados.texto)


@participante.post("/eu/fontes-sugeridas/{fonte_id}", response=DocumentoOut)
def usar_fonte_sugerida(request, fonte_id: int):
    return services.adicionar_fonte_sugerida(request.auth, fonte_id)


@participante.delete("/eu/documentos/{documento_id}", response={204: None})
def remover_documento(request, documento_id: int):
    services.remover_documento(request.auth, documento_id)
    return 204, None


@participante.put("/eu/orientacao", response={204: None})
def salvar_orientacao(request, dados: OrientacaoIn):
    services.salvar_orientacao(request.auth, dados.orientacao)
    return 204, None


@participante.put("/eu/avaliacoes/{pergunta_id}", response=AvaliacaoOut)
def avaliar(request, pergunta_id: int, dados: AvaliacaoIn):
    return services.avaliar(request.auth, pergunta_id, dados.dict())


# ---------------------------------------------------------------- facilitador


@facilitador.get("/facilitador/oficinas", response=list[OficinaOut])
def listar_oficinas(request):
    return services.listar_oficinas()


@facilitador.post("/facilitador/oficinas", response=OficinaDetalheOut)
def criar_oficina(request, dados: NovaOficinaIn):
    oficina = services.criar_oficina(dados.titulo, [p.dict() for p in dados.perguntas])
    return services.detalhe_da_oficina(oficina)


@facilitador.get("/facilitador/oficinas/{oficina_id}", response=OficinaDetalheOut)
def ver_oficina_facilitador(request, oficina_id: int):
    return services.detalhe_da_oficina(services.buscar_oficina(oficina_id))


@facilitador.patch("/facilitador/oficinas/{oficina_id}", response=OficinaDetalheOut)
def atualizar_oficina(request, oficina_id: int, dados: AtualizarOficinaIn):
    oficina = services.buscar_oficina(oficina_id)
    perguntas = [p.dict() for p in dados.perguntas] if dados.perguntas is not None else None
    services.atualizar_oficina(oficina, dados.titulo, dados.aberta, perguntas)
    return services.detalhe_da_oficina(oficina)


@facilitador.delete("/facilitador/oficinas/{oficina_id}", response={204: None})
def apagar_oficina(request, oficina_id: int):
    services.apagar_oficina(services.buscar_oficina(oficina_id))
    return 204, None


@facilitador.post("/facilitador/oficinas/{oficina_id}/fontes", response=DocumentoOut)
def enviar_fonte(request, oficina_id: int, arquivo: UploadedFile = File(...)):
    oficina = services.buscar_oficina(oficina_id)
    return services.adicionar_fonte_da_oficina(oficina, arquivo.name or "", ler_upload(arquivo))


@facilitador.delete("/facilitador/oficinas/{oficina_id}/fontes/{fonte_id}", response={204: None})
def remover_fonte(request, oficina_id: int, fonte_id: int):
    services.remover_fonte_da_oficina(services.buscar_oficina(oficina_id), fonte_id)
    return 204, None


@facilitador.delete("/facilitador/oficinas/{oficina_id}/participantes/{participante_id}", response={204: None})
def apagar_participante(request, oficina_id: int, participante_id: int):
    services.apagar_participante(services.buscar_oficina(oficina_id), participante_id)
    return 204, None


@facilitador.get("/facilitador/oficinas/{oficina_id}/export.csv")
def exportar_csv(request, oficina_id: int):
    oficina = services.buscar_oficina(oficina_id)
    return HttpResponse(
        exportacao.csv_do_relatorio(oficina),
        content_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": content_disposition_header(True, exportacao.nome_do_arquivo(oficina))},
    )
