from django.contrib import admin

from oficina.models import Aluno, Resposta


@admin.register(Aluno)
class AlunoAdmin(admin.ModelAdmin):
    list_display = ("id", "apelido", "turma", "criado_em")
    list_filter = ("turma",)


@admin.register(Resposta)
class RespostaAdmin(admin.ModelAdmin):
    list_display = ("id", "aluno", "etapa", "pergunta", "criado_em")
    list_filter = ("etapa", "aluno__turma")
    search_fields = ("pergunta",)
