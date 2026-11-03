"""Endereços do servidor: `/admin/` (Django admin), `/api/` (a API) e `/` (o site).

Em produção o mesmo processo entrega a API e o site compilado (Vite), então a turma
acessa tudo por um endereço só. Os arquivos do site (JS, CSS) são servidos pelo
WhiteNoise a partir de FRONTEND_DIST; aqui só falta o index.html.
"""
from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import path, re_path

from educagente.api import api


def site(request):
    """Entrega o index.html do site compilado. As rotas do site usam #, então basta ele."""
    indice = settings.FRONTEND_DIST / "index.html"
    if not indice.exists():
        raise Http404("Site não compilado. Rode `npm run build` em frontend/ ou use o Vite em modo dev.")
    return FileResponse(indice.open("rb"), content_type="text/html; charset=utf-8")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
    re_path(r"^$", site),
]
