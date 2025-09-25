from django.urls import path
from . import views
from . import amende_views

app_name = 'vehicules'

urlpatterns = [
    path('', views.vehicle_list, name='vehicle_list'),
    path('add/', views.add_vehicle, name='add_vehicle'),
    path('toggle-stolen/<int:vehicle_id>/', views.toggle_stolen, name='toggle_stolen'),
    path('delete/<int:vehicle_id>/', views.delete_vehicle, name='delete_vehicle'),
    path('amendes/<int:vehicle_id>/', amende_views.get_vehicle_amendes, name='get_vehicle_amendes'),
    path('test-amendes/', amende_views.test_amendes_view, name='test_amendes'),
]
