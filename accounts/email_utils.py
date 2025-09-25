from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)

def send_password_reset_email(user, reset_code):
    """
    Envoie un email avec le code de récupération de mot de passe
    """
    try:
        subject = 'Code de récupération de mot de passe - Mémoire'
        
        # Contexte pour le template
        context = {
            'user': user,
            'code': reset_code.code,
            'expires_minutes': 15,
            'site_name': 'Mémoire - Système de détection de véhicules'
        }
        
        # Rendu du template HTML
        html_message = render_to_string('accounts/emails/password_reset_code.html', context)
        
        # Version texte (fallback)
        plain_message = render_to_string('accounts/emails/password_reset_code.txt', context)
        
        # Envoi de l'email
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False
        )
        
        logger.info(f'Email de récupération envoyé à {user.email}')
        return True
        
    except Exception as e:
        logger.error(f'Erreur lors de l\'envoi de l\'email à {user.email}: {str(e)}')
        return False


def send_password_changed_notification(user):
    """
    Envoie une notification de confirmation de changement de mot de passe
    """
    try:
        subject = 'Mot de passe modifié avec succès - Mémoire'
        
        context = {
            'user': user,
            'site_name': 'Mémoire - Système de détection de véhicules'
        }
        
        # Rendu du template HTML
        html_message = render_to_string('accounts/emails/password_changed.html', context)
        
        # Version texte (fallback)
        plain_message = render_to_string('accounts/emails/password_changed.txt', context)
        
        # Envoi de l'email
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False
        )
        
        logger.info(f'Notification de changement de mot de passe envoyée à {user.email}')
        return True
        
    except Exception as e:
        logger.error(f'Erreur lors de l\'envoi de la notification à {user.email}: {str(e)}')
        return False
