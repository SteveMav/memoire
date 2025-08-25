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
