from django.db import models
from django.contrib.auth.models import User


class Vehicle(models.Model):
    plate = models.CharField(max_length=20, unique=True, verbose_name='Numéro de plaque')
    brand = models.CharField(max_length=50, verbose_name='Marque')
    model = models.CharField(max_length=50, verbose_name='Modèle')
    color = models.CharField(max_length=30, verbose_name='Couleur')
    year = models.IntegerField(null=True, blank=True, verbose_name='Année')
    is_stolen = models.BooleanField(default=False, verbose_name='Véhicule volé')
    stolen_date = models.DateTimeField(null=True, blank=True, verbose_name='Date de vol')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='Propriétaire')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Véhicule'
        verbose_name_plural = 'Véhicules'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.plate} - {self.brand} {self.model}"
