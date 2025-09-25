from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('agent-space/', views.agent_space, name='agent_space'),
    path('search-plate/', views.search_plate, name='search_plate'),
    path('search-amende/', views.search_amende, name='search_amende'),
    path('update-amende-status/', views.update_amende_status, name='update_amende_status'),
    
    # URLs pour la récupération de mot de passe
    path('password-reset/', views.password_reset_request, name='password_reset_request'),
    path('password-reset/code/', views.password_reset_code, name='password_reset_code'),
    path('password-reset/new/', views.password_reset_new, name='password_reset_new'),
    path('password-reset/resend/', views.resend_reset_code, name='resend_reset_code'),
]
