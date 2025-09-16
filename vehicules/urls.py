from django.urls import path
from . import views

app_name = 'vehicules'

urlpatterns = [
    path('', views.vehicle_list, name='vehicle_list'),
    path('add/', views.add_vehicle, name='add_vehicle'),
    path('toggle-stolen/<int:vehicle_id>/', views.toggle_stolen, name='toggle_stolen'),
    path('delete/<int:vehicle_id>/', views.delete_vehicle, name='delete_vehicle'),
]
