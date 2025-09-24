from django.contrib import admin
from .models import Detection, Infraction

# Register your models here.

admin.site.register(Detection)
admin.site.register(Infraction)

