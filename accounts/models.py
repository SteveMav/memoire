from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
import random
import string

class Profile(models.Model):
    USER_TYPE_CHOICES = [
        ('simple', 'Utilisateur Simple'),
        ('agent', 'Agent'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    user_type = models.CharField(
        max_length=10, 
        choices=USER_TYPE_CHOICES, 
        default='simple',
        verbose_name='Type d\'utilisateur'
    )
    agent_number = models.CharField(
        max_length=20, 
        blank=True, 
        null=True, 
        verbose_name='Numéro matricule',
        help_text='Obligatoire pour les agents'
    )
    phone = models.CharField(max_length=15, blank=True, verbose_name='Téléphone')
    address = models.TextField(blank=True, verbose_name='Adresse')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Profil'
        verbose_name_plural = 'Profils'
    
    def __str__(self):
        return f"{self.user.username} - {self.get_user_type_display()}"
    
    def is_agent(self):
        return self.user_type == 'agent'
    
    def can_detect(self):
        return self.user_type == 'agent'

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()


class AgentCode(models.Model):
    """Modèle pour stocker les codes d'agents générés par l'admin"""
    code = models.CharField(max_length=6, unique=True, verbose_name='Code agent')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='Créé par', related_name='generated_agent_codes')
    is_used = models.BooleanField(default=False, verbose_name='Utilisé')
    used_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Utilisé par', related_name='used_agent_code')
    used_at = models.DateTimeField(null=True, blank=True, verbose_name='Utilisé le')
    
    class Meta:
        verbose_name = 'Code agent'
        verbose_name_plural = 'Codes agents'
        ordering = ['-created_at']
    
    def __str__(self):
        status = "Utilisé" if self.is_used else "Disponible"
        return f"Code {self.code} - {status}"
    
    @classmethod
    def generate_code(cls, created_by):
        """Génère un nouveau code agent unique"""
        max_attempts = 100
        for _ in range(max_attempts):
            # Générer un code à 6 chiffres
            code = ''.join(random.choices(string.digits, k=6))
            
            # Vérifier l'unicité
            if not cls.objects.filter(code=code).exists():
                # Créer le nouveau code
                agent_code = cls.objects.create(
                    code=code,
                    created_by=created_by
                )
                return agent_code
        
        raise ValueError("Impossible de générer un code unique après plusieurs tentatives")
    
    def mark_as_used(self, user):
        """Marque le code comme utilisé par un utilisateur"""
        self.is_used = True
        self.used_by = user
        self.used_at = timezone.now()
        self.save()
    
    def is_available(self):
        """Vérifie si le code est disponible pour utilisation"""
        return not self.is_used


class PasswordResetCode(models.Model):
    """Modèle pour stocker les codes de récupération de mot de passe"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='Utilisateur')
    code = models.CharField(max_length=6, verbose_name='Code de récupération')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    expires_at = models.DateTimeField(verbose_name='Expire le')
    is_used = models.BooleanField(default=False, verbose_name='Utilisé')
    
    class Meta:
        verbose_name = 'Code de récupération'
        verbose_name_plural = 'Codes de récupération'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Code {self.code} pour {self.user.email}"
    
    @classmethod
    def generate_code(cls, user):
        """Génère un nouveau code de récupération pour un utilisateur"""
        # Supprimer les anciens codes non utilisés
        cls.objects.filter(user=user, is_used=False).delete()
        
        # Générer un code à 6 chiffres
        code = ''.join(random.choices(string.digits, k=6))
        
        # Définir l'expiration à 15 minutes
        expires_at = timezone.now() + timezone.timedelta(minutes=15)
        
        # Créer le nouveau code
        reset_code = cls.objects.create(
            user=user,
            code=code,
            expires_at=expires_at
        )
        
        return reset_code
    
    def is_valid(self):
        """Vérifie si le code est encore valide"""
        return not self.is_used and timezone.now() < self.expires_at
    
    def mark_as_used(self):
        """Marque le code comme utilisé"""
        self.is_used = True
        self.save()
