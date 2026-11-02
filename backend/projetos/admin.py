from django.contrib import admin

from projetos.models import Projeto, ProjetoDocumento, ProjetoResposta


class DocumentoInline(admin.TabularInline):
    model = ProjetoDocumento
    extra = 0


@admin.register(Projeto)
class ProjetoAdmin(admin.ModelAdmin):
    list_display = ("id", "nome", "aluno", "model_provider", "model_name", "atualizado_em")
    list_filter = ("model_provider",)
    inlines = [DocumentoInline]


@admin.register(ProjetoResposta)
class ProjetoRespostaAdmin(admin.ModelAdmin):
    list_display = ("id", "projeto", "modo", "pergunta", "nada_relevante", "criado_em")
    list_filter = ("modo", "nada_relevante")
    search_fields = ("pergunta",)
