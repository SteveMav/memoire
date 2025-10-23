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
    category = models.CharField(
        max_length=50,
        choices=CATEGORIE_CHOICES,
        verbose_name="Catégorie de l'infraction"
    )
    description = models.TextField(
        verbose_name="Description de l'infraction"
    )
    amount_min = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Amende minimale (Fc)"
    )
    amount_max = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Amende maximale (Fc)"
    )
    class Meta:
        verbose_name = "Infraction"
        verbose_name_plural = "Infractions"
        ordering = ['code_article']

    def __str__(self):
        return f"{self.code_article} - {self.description[:70]}..."

    def get_amende(self):
        """Retourne l'amende à appliquer (moyenne si fourchette, sinon min ou max)"""
        if self.amount_min and self.amount_max:
            return (self.amount_min + self.amount_max) / 2
        return self.amount_min or self.amount_max or 0

    def has_amende(self):
        """Vérifie si l'infraction a une amende définie"""
        return bool(self.amount_min or self.amount_max)




class Amende(models.Model):
    """
    Modèle représentant une amende émise suite à une détection d'infraction
    """
    STATUT_CHOICES = [
        ('EMISE', 'Émise'),
        ('PAYEE', 'Payée'),
        ('CONTESTEE', 'Contestée'),
        ('ANNULEE', 'Annulée'),
    ]

    # Relations
    detection = models.ForeignKey(
        Detection, 
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name="Détection associée"
    )
    infraction = models.ForeignKey(
        Infraction, 
        on_delete=models.CASCADE,
        verbose_name="Infraction commise"
    )
    vehicle = models.ForeignKey(
        Vehicle, 
        on_delete=models.CASCADE,
        verbose_name="Véhicule en infraction"
    )
    agent = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True,
        verbose_name="Agent verbalisateur"
    )

    # Informations de l'amende
    numero_amende = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="Numéro d'amende"
    )
    montant = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Montant de l'amende (Fc)"
    )
    statut = models.CharField(
        max_length=20,
        choices=STATUT_CHOICES,
        default='EMISE',
        verbose_name="Statut de l'amende"
    )

    # Dates
    date_emission = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Date d'émission"
    )
    date_limite_paiement = models.DateField(
        verbose_name="Date limite de paiement"
    )
    date_paiement = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Date de paiement"
    )

    # Informations complémentaires
    lieu_infraction = models.CharField(
        max_length=200,
        verbose_name="Lieu de l'infraction"
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name="Latitude GPS"
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name="Longitude GPS"
    )
    observations = models.TextField(
        blank=True,
        verbose_name="Observations"
    )
    email_envoye = models.BooleanField(
        default=False,
        verbose_name="Email de notification envoyé"
    )

    class Meta:
        verbose_name = "Amende"
        verbose_name_plural = "Amendes"
        ordering = ['-date_emission']

    def __str__(self):
        return f"Amende {self.numero_amende} - {self.vehicle.plate} ({self.montant} Z)"

    def save(self, *args, **kwargs):
        # Générer automatiquement le numéro d'amende si pas défini
        if not self.numero_amende:
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            self.numero_amende = f"AM{timestamp}"
        
        # Définir le montant basé sur l'infraction si pas défini
        if not self.montant and self.infraction:
            self.montant = self.infraction.get_amende()
        
        super().save(*args, **kwargs)
