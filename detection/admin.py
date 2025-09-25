from django.contrib import admin
from .models import Detection, Infraction, Amende

# Register your models here.

@admin.register(Detection)
class DetectionAdmin(admin.ModelAdmin):
    list_display = ['detected_plate', 'detection_date', 'found_vehicle', 'user']
    list_filter = ['detection_date', 'user']
    search_fields = ['detected_plate']

@admin.register(Infraction)
class InfractionAdmin(admin.ModelAdmin):
    list_display = ['code_article', 'category', 'description', 'get_amende']
    list_filter = ['category']
    search_fields = ['code_article', 'description']

@admin.register(Amende)
class AmendeAdmin(admin.ModelAdmin):
    list_display = ['numero_amende', 'vehicle', 'infraction', 'montant', 'statut', 'date_emission']
    list_filter = ['statut', 'date_emission', 'infraction__category']
    search_fields = ['numero_amende', 'vehicle__plate_number', 'vehicle__owner__email']
    readonly_fields = ['numero_amende', 'date_emission']

