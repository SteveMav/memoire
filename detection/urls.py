from django.urls import path
from . import views

app_name = "detection"


urlpatterns = [
    path('', views.detect_home, name='detect_home'),
]