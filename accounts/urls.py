from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('agent-space/', views.agent_space, name='agent_space'),
    path('search-plate/', views.search_plate, name='search_plate'),
]
