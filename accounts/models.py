from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

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
