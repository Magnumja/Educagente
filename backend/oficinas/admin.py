from django.contrib import admin

from oficinas.models import Avaliacao, Documento, Oficina, Participante, Pergunta, Resposta


class PerguntaInline(admin.TabularInline):
    model = Pergunta
    extra = 0


@admin.register(Oficina)
class OficinaAdmin(admin.ModelAdmin):
    list_display = ("titulo", "codigo", "aberta", "criado_em")
    inlines = [PerguntaInline]


@admin.register(Participante)
class ParticipanteAdmin(admin.ModelAdmin):
    list_display = ("apelido", "oficina", "criado_em")
    list_filter = ("oficina",)
    exclude = ("token_hash",)


@admin.register(Documento)
class DocumentoAdmin(admin.ModelAdmin):
    list_display = ("nome", "origem", "oficina", "participante", "paginas", "criado_em")


@admin.register(Resposta)
class RespostaAdmin(admin.ModelAdmin):
    list_display = ("participante", "pergunta", "tentativa", "nada_relevante", "criado_em")
    list_filter = ("tentativa", "pergunta__oficina")


@admin.register(Avaliacao)
class AvaliacaoAdmin(admin.ModelAdmin):
    list_display = ("participante", "pergunta", "primeira", "segunda", "mais_confiavel", "conferiu_fonte")
