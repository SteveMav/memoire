"""
Utilitaires pour l'envoi d'emails dans l'application de détection
"""
import logging
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def send_vehicle_found_email(vehicle, detection, agent):
    """
    Envoie un email au propriétaire d'un véhicule volé qui a été retrouvé
    
    Args:
        vehicle: Instance du modèle Vehicle (véhicule retrouvé)
        detection: Instance du modèle Detection (détection effectuée)
        agent: Instance User de l'agent qui a effectué la détection
    
    Returns:
        bool: True si l'email a été envoyé avec succès, False sinon
    """
    try:
        # Vérifier que le véhicule est bien marqué comme volé
        if not vehicle.is_stolen:
            logger.warning(f"Tentative d'envoi d'email pour un véhicule non volé: {vehicle.plate}")
            return False
        
        # Vérifier que le propriétaire a une adresse email
        if not vehicle.owner.email:
            logger.warning(f"Propriétaire sans email pour le véhicule {vehicle.plate}")
            return False
        
        # Préparer le contexte pour les templates
        context = {
            'vehicle': vehicle,
            'owner': vehicle.owner,
            'detection': detection,
            'agent': agent,
            'detected_plate': detection.detected_plate,
            'detection_date': detection.detection_date,
            'current_date': timezone.now(),
        }
        
        # Générer le contenu HTML et texte
        html_content = render_to_string('detection/vehicle_found_email.html', context)
        text_content = render_to_string('detection/vehicle_found_email.txt', context)
        
        # Créer l'email
        subject = f"🚗 Véhicule Retrouvé - {vehicle.plate} | Système Mémoire"
        from_email = settings.EMAIL_HOST_USER
        to_email = [vehicle.owner.email]
        
        # Créer l'email avec version HTML et texte
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=to_email
        )
        
        # Attacher la version HTML
        email.attach_alternative(html_content, "text/html")
        
        # Envoyer l'email
        email.send()
        
        logger.info(f"Email envoyé avec succès pour le véhicule {vehicle.plate} à {vehicle.owner.email}")
        return True
        
    except Exception as e:
        logger.error(f"Erreur lors de l'envoi de l'email pour le véhicule {vehicle.plate}: {str(e)}")
        return False


def send_multiple_vehicles_found_email(vehicles_data, agent):
    """
    Envoie des emails pour plusieurs véhicules volés retrouvés
    
    Args:
        vehicles_data: Liste de tuples (vehicle, detection)
        agent: Instance User de l'agent qui a effectué les détections
    
    Returns:
        dict: Statistiques d'envoi {'sent': int, 'failed': int, 'total': int}
    """
    stats = {'sent': 0, 'failed': 0, 'total': len(vehicles_data)}
    
    for vehicle, detection in vehicles_data:
        if send_vehicle_found_email(vehicle, detection, agent):
            stats['sent'] += 1
        else:
            stats['failed'] += 1
    
    logger.info(f"Envoi d'emails terminé: {stats['sent']}/{stats['total']} envoyés avec succès")
    return stats


def test_email_configuration():
    """
    Teste la configuration email
    
    Returns:
        bool: True si la configuration est valide, False sinon
    """
    try:
        from django.core.mail import get_connection
        
        # Vérifier les paramètres requis
        required_settings = [
            'EMAIL_HOST_USER',
            'EMAIL_HOST_PASSWORD',
            'EMAIL_HOST',
            'EMAIL_PORT'
        ]
        
        for setting in required_settings:
            if not hasattr(settings, setting) or not getattr(settings, setting):
                logger.error(f"Configuration email manquante: {setting}")
                return False
        
        # Tester la connexion
        connection = get_connection()
        connection.open()
        connection.close()
        
        logger.info("Configuration email valide")
        return True
        
    except Exception as e:
        logger.error(f"Erreur de configuration email: {str(e)}")
        return False
