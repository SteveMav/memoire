from django.shortcuts import render
from django.views.generic import TemplateView

# Create your views here.

def home(request):
    return render(request, 'home.html')

def about(request):
    context = {
        'page_title': 'À propos de PlateDetect',
        'active_page': 'about'
    }
    return render(request, 'about.html', context)

# Gestionnaires d'erreurs personnalisés
def custom_404(request, exception=None):
    """Vue personnalisée pour les erreurs 404"""
    return render(request, '404.html', status=404)

def custom_500(request):
    """Vue personnalisée pour les erreurs 500"""
    return render(request, '500.html', status=500)

def custom_403(request, exception=None):
    """Vue personnalisée pour les erreurs 403"""
    return render(request, '403.html', status=403)

def custom_400(request, exception=None):
    """Vue personnalisée pour les erreurs 400"""
    return render(request, '400.html', status=400)
