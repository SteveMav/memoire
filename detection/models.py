from django.db import models
from django.contrib.auth.models import User
from vehicules.models import Vehicle

class Detection(models.Model):
    image = models.ImageField(upload_to='detection_images/', null=True, blank=True)
    video = models.FileField(upload_to='detection_videos/', null=True, blank=True)
    detected_plate = models.CharField(max_length=20)
    detection_date = models.DateTimeField(auto_now_add=True)
    found_vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"{self.detected_plate} detected on {self.detection_date}"


class Infraction(models.Model):
    """
    Modèle représentant un type d'infraction routière
    basé sur le Nouveau Code de la Route de la RDC.
    """
    CATEGORIE_CHOICES = [
        ('CONDUITE', 'Conduite des véhicules et des animaux'),
        ('USAGE_VOIE', "Usage des voies ouvertes à la circulation"),
        ('VEHICULE', 'Equipement des véhicules'),
        ('ADMINISTRATIF', 'Conditions administratives et documents'),
        ('PERMIS', 'Permis de conduire'),
        ('GENERAL', 'Dispositions générales'),
    ]

    code_article = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="Code de l'article",
        help_text="Référence de l'article dans le code de la route (ex: 106.4)."
    )
    categorie = models.CharField(
        max_length=50,
        choices=CATEGORIE_CHOICES,
        verbose_name="Catégorie de l'infraction"
    )
    description = models.TextField(
        verbose_name="Description de l'infraction"
    )
    montant_min = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Amende minimale (Z)"
    )
    montant_max = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Amende maximale (Z)"
    )
    double_en_recidive = models.BooleanField(
        default=False,
        verbose_name="Amende doublée en cas de récidive"
    )
    peut_entrainer_suspension = models.BooleanField(
        default=False,
        verbose_name="Peut entraîner une suspension du permis",
        help_text="Basé sur l'article 131."
    )
    peut_entrainer_immobilisation = models.BooleanField(
        default=False,
        verbose_name="Peut entraîner une immobilisation du véhicule",
        help_text="Basé sur l'article 136."
    )

    class Meta:
        verbose_name = "Infraction"
        verbose_name_plural = "Infractions"
        ordering = ['code_article']

    def __str__(self):
        return f"{self.code_article} - {self.description[:70]}..."
