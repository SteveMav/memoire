from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('a-propos/', views.about, name='about'),
    
    # URLs de test pour les pages d'erreur (à retirer en production)
]