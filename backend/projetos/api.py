from django.http import HttpResponse
from django.utils.http import content_disposition_header
from ninja import File, Header, Router, UploadedFile

from oficina.services import buscar_aluno
from projetos import services
from projetos.models import Projeto
from projetos.schemas import (
    AtualizarProjeto,
    ComparacaoOut,
    DocumentoOut,
    NovoProjeto,
    PerguntaProjeto,
    ProjetoComDocumentosOut,
    ProjetoOut,
    RespostaOut,
)

router = Router(tags=["projetos"])
BASE = "/alunos/{aluno_id}/projetos"
# BYOK: a chave do aluno chega por requisição e nunca é gravada.
ChaveDoAluno = Header(default=None, alias="X-Provider-Api-Key")


def projeto_do_aluno(aluno_id: int, projeto_id: int) -> Projeto:
    return services.buscar_projeto(buscar_aluno(aluno_id), projeto_id)


@router.post(BASE, response=ProjetoOut)
def criar_projeto(request, aluno_id: int, dados: NovoProjeto):
    aluno = buscar_aluno(aluno_id)
    return services.criar_projeto(aluno, dados.nome, dados.descricao, dados.model_provider, dados.cenario_id)


@router.get(BASE, response=list[ProjetoOut])
def listar_projetos(request, aluno_id: int):
    return buscar_aluno(aluno_id).projetos.all()


@router.get(BASE + "/{projeto_id}", response=ProjetoComDocumentosOut)
def ver_projeto(request, aluno_id: int, projeto_id: int):
    return projeto_do_aluno(aluno_id, projeto_id)


@router.patch(BASE + "/{projeto_id}", response=ProjetoOut)
def atualizar_projeto(request, aluno_id: int, projeto_id: int, dados: AtualizarProjeto):
    projeto = projeto_do_aluno(aluno_id, projeto_id)
    return services.atualizar_projeto(projeto, dados.dict(exclude_none=True))


@router.post(BASE + "/{projeto_id}/documentos", response=DocumentoOut)
def enviar_documento(request, aluno_id: int, projeto_id: int, arquivo: UploadedFile = File(...)):
    projeto = projeto_do_aluno(aluno_id, projeto_id)
    return services.enviar_documento(projeto, arquivo.name or "", arquivo.read())


@router.post(BASE + "/{projeto_id}/perguntar", response=RespostaOut)
def perguntar(request, aluno_id: int, projeto_id: int, dados: PerguntaProjeto, api_key: str | None = ChaveDoAluno):
    projeto = projeto_do_aluno(aluno_id, projeto_id)
    return services.responder(projeto, dados.pergunta, "prompt_rag", api_key)


@router.post(BASE + "/{projeto_id}/comparar", response=ComparacaoOut)
def comparar(request, aluno_id: int, projeto_id: int, dados: PerguntaProjeto, api_key: str | None = ChaveDoAluno):
    projeto = projeto_do_aluno(aluno_id, projeto_id)
    return {"pergunta": dados.pergunta.strip(), "camadas": services.comparar(projeto, dados.pergunta, api_key)}


@router.get(BASE + "/{projeto_id}/comparacoes", response=list[ComparacaoOut])
def comparacoes(request, aluno_id: int, projeto_id: int):
    return services.agrupar_comparacoes(projeto_do_aluno(aluno_id, projeto_id))


@router.get(BASE + "/{projeto_id}/exportar")
def exportar(request, aluno_id: int, projeto_id: int):
    projeto = projeto_do_aluno(aluno_id, projeto_id)
    nome_arquivo = f"projeto-{projeto.pk}-{projeto.nome.strip().lower().replace(' ', '-')}.zip"
    return HttpResponse(
        services.exportar_zip(projeto),
        content_type="application/zip",
        headers={"Content-Disposition": content_disposition_header(as_attachment=True, filename=nome_arquivo)},
    )
