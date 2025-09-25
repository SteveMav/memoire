from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from . import views

app_name = "detection"

urlpatterns = [
    path('', views.detect_home, name='detect_home'),
    path('save-corrected-plates/', views.save_corrected_plates, name='save_corrected_plates'),
    path('extract-manual-plate/', views.extract_manual_plate, name='extract_manual_plate'),
    path('test-email/', views.test_email_system, name='test_email_system'),
    path('get-infractions/', views.get_infractions, name='get_infractions'),
    path('emettre-amende/', views.emettre_amende, name='emettre_amende'),
]

# Ajouter le support pour les fichiers média en développement
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)