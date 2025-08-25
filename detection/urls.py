from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from . import views

app_name = "detection"

urlpatterns = [
    path('', views.detect_home, name='detect_home'),
    # path('dd', views.detect_vehicle, name="dd")
]

# Ajouter le support pour les fichiers média en développement
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)