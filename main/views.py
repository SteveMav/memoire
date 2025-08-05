from django.shortcuts import render
from django.views.generic import TemplateView

# Create your views here.

def home(request):
    return render(request, 'home.html')

class AboutView(TemplateView):
    template_name = 'about.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['page_title'] = 'À propos de PlateDetect'
        context['active_page'] = 'about'
        return context
