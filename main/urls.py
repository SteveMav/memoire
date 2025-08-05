from django.urls import path
from . import views
from .views import AboutView

urlpatterns = [
    path('', views.home, name='home'),
    path('a-propos/', AboutView.as_view(), name='about'),
]