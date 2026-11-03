from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import path, re_path

from educagente.api import api


def site(request):
    """Entrega o site já compilado (frontend/dist), quando ele existe: assim a turma
    acessa tudo por um endereço só. As rotas do site usam #, então basta o index."""
    indice = settings.FRONTEND_DIST / "index.html"
    if not indice.exists():
        raise Http404("Site não compilado. Rode `npm run build` em frontend/ ou use o Vite em modo dev.")
    return FileResponse(indice.open("rb"), content_type="text/html; charset=utf-8")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
    re_path(r"^$", site),
]
