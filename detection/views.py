import os
import cv2
from django.conf import settings
from django.shortcuts import render
from django.core.files.storage import FileSystemStorage
from django.http import JsonResponse
from .car_detector import CarDetector
from django.contrib.auth.decorators import login_required, permission_required
from vehicules.models import Vehicle
from .models import Detection
from .email_utils import send_vehicle_found_email
import logging

logger = logging.getLogger(__name__)


@login_required
@permission_required('detection.add_detection', raise_exception=True)
def detect_home(request):
    """Page d'accueil avec détection de véhicules et de plaques"""
    if request.method == 'POST' and request.FILES.get('media'):
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        
        try:
            # Créer le détecteur
            detector = CarDetector()
            
            # Sauvegarder le fichier
            uploaded_file = request.FILES['media']
            fs = FileSystemStorage()
            filename = fs.save(uploaded_file.name, uploaded_file)
            file_path = os.path.join(settings.MEDIA_ROOT, filename)
            
            # Vérifier le type de fichier
            if not uploaded_file.content_type.startswith('image'):
                error_msg = 'Seules les images sont acceptées.'
                if is_ajax:
                    return JsonResponse({'error': error_msg}, status=400)
                return render(request, 'detection/home_detect.html', {'error': error_msg})
            
            # Processus de détection
            result_image, detection_results = detector.process_detection(file_path)
            
            # Traiter les résultats
            plates_data = []
            for i, vehicle in enumerate(detection_results):
                for j, plate in enumerate(vehicle['plates']):
                    # Sauvegarder l'image de plaque
                    plate_filename = f"plate_{i}_{j}_{filename}"
                    plate_path = os.path.join(settings.MEDIA_ROOT, plate_filename)
                    cv2.imwrite(plate_path, plate['image'])
                    
                    plates_data.append({
                        'plate_id': f"{i}_{j}",
                        'plate_image': fs.url(plate_filename).lstrip('/'),
                        'plate_text': plate['text'],
                        'confidence': f"{plate['confidence']:.2f}",
                        'vehicle_id': i
                    })
            
            # Sauvegarder l'image avec détections
            result_filename = f"result_{filename}"
            result_path = os.path.join(settings.MEDIA_ROOT, result_filename)
            cv2.imwrite(result_path, result_image)
            
            # Préparer la réponse
            response = {
                'original_image': fs.url(filename).lstrip('/'),
                'processed_image': fs.url(result_filename).lstrip('/'),
                'vehicles_detected': len(detection_results),
                'plates_detected': len(plates_data),
                'plates': plates_data,
                'success': True
            }
            
            if is_ajax:
                return JsonResponse(response)
            return render(request, 'detection/home_detect.html', response)
            
        except Exception as e:
            error_msg = f"Erreur de détection: {str(e)}"
            if is_ajax:
                return JsonResponse({'error': error_msg}, status=500)
            return render(request, 'detection/home_detect.html', {'error': error_msg})
    
    return render(request, 'detection/home_detect.html')



@login_required
@permission_required('detection.add_detection', raise_exception=True)
def save_corrected_plates(request):
    """Sauvegarde les textes de plaques corrigés par l'utilisateur"""
    if request.method == 'POST':
        try:
            import json
            data = json.loads(request.body)
            corrected_plates = data.get('plates', [])
            original_image = data.get('original_image', None)  # Image originale si disponible
            
            # Normaliser et rechercher chaque plaque dans les véhicules
            matches = []
            for item in corrected_plates:
                # Accepter à la fois corrected_text (édition de lot) et plate_text (sélection manuelle)
                raw_text = (item.get('corrected_text') or item.get('plate_text') or '').strip()
                # Normalisation de base: majuscules et suppression des espaces internes superflus
                normalized = ''.join(raw_text.upper().split())

                entry = {
                    'query_plate': raw_text,
                    'normalized_plate': normalized,
                }

                vehicle = None
                if normalized:
                    vehicle = Vehicle.objects.filter(plate__iexact=normalized).first()

                if vehicle:
                    # Créer une nouvelle détection dans la base de données
                    detection = Detection.objects.create(
                        image=original_image if original_image else None,
                        detected_plate=normalized,
                        found_vehicle=vehicle,
                        user=request.user
                    )
                    
                    # Vérifier si le véhicule est volé et envoyer un email automatiquement
                    email_sent = False
                    if vehicle.is_stolen:
                        try:
                            email_sent = send_vehicle_found_email(vehicle, detection, request.user)
                            if email_sent:
                                logger.info(f"Email envoyé avec succès pour le véhicule volé {vehicle.plate}")
                            else:
                                logger.warning(f"Échec de l'envoi d'email pour le véhicule volé {vehicle.plate}")
                        except Exception as e:
                            logger.error(f"Erreur lors de l'envoi d'email pour {vehicle.plate}: {str(e)}")
                    
                    entry.update({
                        'found': True,
                        'detection_id': detection.id,
                        'email_sent': email_sent,
                        'vehicle': {
                            'id': vehicle.id,  # Ajout de l'ID manquant !
                            'plate': vehicle.plate,
                            'brand': vehicle.brand,
                            'model': vehicle.model,
                            'color': vehicle.color,
                            'year': vehicle.year,
                            'is_stolen': vehicle.is_stolen,
                            'stolen_date': vehicle.stolen_date.isoformat() if vehicle.stolen_date else None,
                            'created_at': vehicle.created_at.isoformat(),
                            'updated_at': vehicle.updated_at.isoformat(),
                        },
                        'owner': {
                            'id': vehicle.owner.id,
                            'username': vehicle.owner.username,
                            'first_name': vehicle.owner.first_name,
                            'last_name': vehicle.owner.last_name,
                            'email': vehicle.owner.email,
                        }
                    })
                else:
                    # Créer une détection même si aucun véhicule n'est trouvé
                    if normalized:  # Seulement si on a une plaque valide
                        detection = Detection.objects.create(
                            image=original_image if original_image else None,
                            detected_plate=normalized,
                            found_vehicle=None,
                            user=request.user
                        )
                        entry.update({
                            'found': False,
                            'detection_id': detection.id,
                            'message': 'Aucun véhicule trouvé pour cette plaque'
                        })
                    else:
                        entry.update({
                            'found': False,
                            'message': 'Plaque invalide ou vide'
                        })

                matches.append(entry)
            
            # Compter les emails envoyés
            emails_sent = sum(1 for match in matches if match.get('email_sent', False))
            stolen_vehicles_found = sum(1 for match in matches if match.get('found', False) and match.get('vehicle', {}).get('is_stolen', False))
            
            # Préparer le message de réponse
            message = f'{len(corrected_plates)} plaque(s) sauvegardée(s) avec succès'
            if stolen_vehicles_found > 0:
                message += f' - {stolen_vehicles_found} véhicule(s) volé(s) détecté(s)'
                if emails_sent > 0:
                    message += f' - {emails_sent} email(s) de notification envoyé(s) et statut mis à jour'
            
            return JsonResponse({
                'success': True,
                'message': message,
                'plates': corrected_plates,
                'matches': matches,
                'stats': {
                    'total_plates': len(corrected_plates),
                    'vehicles_found': len([m for m in matches if m.get('found', False)]),
                    'stolen_vehicles_found': stolen_vehicles_found,
                    'emails_sent': emails_sent
                }
            })
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Méthode non autorisée'}, status=405)


@login_required
@permission_required('detection.add_detection', raise_exception=True)
def extract_manual_plate(request):
    """Extrait le texte d'une région de plaque sélectionnée manuellement en utilisant l'algorithme de détection existant"""
    if request.method == 'POST':
        try:
            import json
            import logging
            logger = logging.getLogger(__name__)
            
            data = json.loads(request.body)
            logger.info(f"Données reçues: {data}")
            
            # Récupérer les coordonnées de la sélection
            image_path = data.get('image_path')
            x1 = data.get('x1')
            y1 = data.get('y1')
            x2 = data.get('x2')
            y2 = data.get('y2')
            
            # Validation des données
            if not image_path:
                return JsonResponse({'error': 'Chemin d\'image manquant'}, status=400)
            
            if any(coord is None for coord in [x1, y1, x2, y2]):
                return JsonResponse({'error': 'Coordonnées manquantes'}, status=400)
            
            try:
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            except (ValueError, TypeError):
                return JsonResponse({'error': 'Coordonnées invalides'}, status=400)
            
            # Vérifier que les coordonnées sont valides
            if x1 >= x2 or y1 >= y2:
                return JsonResponse({'error': f'Coordonnées invalides: x1={x1}, y1={y1}, x2={x2}, y2={y2}'}, status=400)
            
            # Nettoyer le chemin de l'image (supprimer le préfixe media/ s'il existe)
            clean_image_path = image_path
            if clean_image_path.startswith('media/'):
                clean_image_path = clean_image_path[6:]  # Supprimer 'media/'
            
            # Décoder l'URL pour gérer les caractères spéciaux comme %20 (espaces)
            from urllib.parse import unquote
            clean_image_path = unquote(clean_image_path)
            
            # Charger l'image originale
            full_image_path = os.path.join(settings.MEDIA_ROOT, clean_image_path)
            logger.info(f"Chemin original: {image_path}")
            logger.info(f"Chemin nettoyé: {clean_image_path}")
            logger.info(f"Chemin complet de l'image: {full_image_path}")
            
            if not os.path.exists(full_image_path):
                return JsonResponse({'error': f'Fichier image non trouvé: {full_image_path}'}, status=404)
            
            image = cv2.imread(full_image_path)
            
            if image is None:
                return JsonResponse({'error': 'Impossible de charger l\'image'}, status=404)
            
            # Vérifier les dimensions de l'image
            img_height, img_width = image.shape[:2]
            logger.info(f"Dimensions de l'image: {img_width}x{img_height}")
            logger.info(f"Coordonnées de sélection: ({x1},{y1}) à ({x2},{y2})")
            
            # Ajuster les coordonnées si elles dépassent les limites de l'image
            x1 = max(0, min(x1, img_width - 1))
            y1 = max(0, min(y1, img_height - 1))
            x2 = max(x1 + 1, min(x2, img_width))
            y2 = max(y1 + 1, min(y2, img_height))
            
            # Extraire la région sélectionnée
            plate_region = image[y1:y2, x1:x2]
            
            if plate_region.size == 0:
                return JsonResponse({'error': f'Région vide après extraction: {y1}:{y2}, {x1}:{x2}'}, status=400)
            
            # Créer une instance du détecteur
            detector = CarDetector()
            
            # Puisque la région est déjà sélectionnée manuellement, essayer d'abord de détecter
            # des plaques dans cette région avec le modèle entraîné
            plates = detector.detect_plates(plate_region)
            
            if plates:
                # Si des plaques sont détectées, prendre la première (plus grande confiance)
                best_plate = plates[0]
                px1, py1, px2, py2 = best_plate['bbox']
                
                # Extraire la région de la plaque détectée pour l'OCR
                detected_plate_region = plate_region[py1:py2, px1:px2]
                
                # Extraire le texte avec OCR sur la plaque détectée
                plate_text, confidence = detector.extract_text(detected_plate_region)
                
                # Sauvegarder l'image de la région MANUELLE complète (pas seulement la plaque détectée)
                fs = FileSystemStorage()
                plate_filename = f"manual_selection_{os.path.basename(image_path)}"
                plate_path = os.path.join(settings.MEDIA_ROOT, plate_filename)
                cv2.imwrite(plate_path, plate_region)  # Sauvegarder toute la région sélectionnée
                
                return JsonResponse({
                    'success': True,
                    'plate_text': plate_text,
                    'confidence': confidence,
                    'plate_image': fs.url(plate_filename).lstrip('/'),
                    'coordinates': {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2},
                    'detected_plate_coords': {'x1': px1, 'y1': py1, 'x2': px2, 'y2': py2},
                    'detection_method': 'automatic_in_manual_region'
                })
            else:
                # Si aucune plaque n'est détectée automatiquement, utiliser OCR direct sur toute la région
                # Appliquer le préprocessing et l'OCR directement
                plate_text, confidence = detector.extract_text(plate_region)
                
                # Sauvegarder l'image de la région sélectionnée complète
                fs = FileSystemStorage()
                plate_filename = f"manual_selection_{os.path.basename(image_path)}"
                plate_path = os.path.join(settings.MEDIA_ROOT, plate_filename)
                cv2.imwrite(plate_path, plate_region)  # Sauvegarder toute la région sélectionnée
                
                return JsonResponse({
                    'success': True,
                    'plate_text': plate_text,
                    'confidence': confidence,
                    'plate_image': fs.url(plate_filename).lstrip('/'),
                    'coordinates': {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2},
                    'detection_method': 'ocr_only'
                })
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Méthode non autorisée'}, status=405)


@login_required
@permission_required('detection.add_detection', raise_exception=True)
def test_email_system(request):
    """Vue de test pour vérifier le système d'envoi d'email"""
    if request.method == 'POST':
        try:
            from .email_utils import test_email_configuration
            import json
            
            data = json.loads(request.body)
            vehicle_id = data.get('vehicle_id')
            
            if not vehicle_id:
                return JsonResponse({'error': 'ID du véhicule requis'}, status=400)
            
            # Vérifier la configuration email
            if not test_email_configuration():
                return JsonResponse({
                    'error': 'Configuration email invalide. Vérifiez les paramètres EMAIL_* dans settings.py'
                }, status=500)
            
            # Récupérer le véhicule
            try:
                vehicle = Vehicle.objects.get(id=vehicle_id)
            except Vehicle.DoesNotExist:
                return JsonResponse({'error': 'Véhicule non trouvé'}, status=404)
            
            # Créer une détection de test
            detection = Detection.objects.create(
                detected_plate=vehicle.plate,
                found_vehicle=vehicle,
                user=request.user
            )
            
            # Envoyer l'email de test
            email_sent = send_vehicle_found_email(vehicle, detection, request.user)
            
            if email_sent:
                return JsonResponse({
                    'success': True,
                    'message': f'Email de test envoyé avec succès à {vehicle.owner.email}',
                    'vehicle_plate': vehicle.plate,
                    'owner_email': vehicle.owner.email
                })
            else:
                return JsonResponse({
                    'error': 'Échec de l\'envoi de l\'email de test'
                }, status=500)
                
        except Exception as e:
            logger.error(f"Erreur lors du test d'email: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Méthode non autorisée'}, status=405)


@login_required
@permission_required('detection.add_detection', raise_exception=True)
def get_infractions(request):
    """Récupère la liste des infractions disponibles pour émission d'amende"""
    if request.method == 'GET':
        try:
            from .models import Infraction
            
            infractions = Infraction.objects.all().values(
                'id', 'code_article', 'category', 'description', 
                'amount_min', 'amount_max'
            )
            
            infractions_list = []
            for infraction in infractions:
                # Calculer l'amende moyenne
                amount_min = float(infraction['amount_min'] or 0)
                amount_max = float(infraction['amount_max'] or 0)
                
                if amount_min and amount_max:
                    amende_moyenne = (amount_min + amount_max) / 2
                else:
                    amende_moyenne = amount_min or amount_max or 0
                
                infractions_list.append({
                    'id': infraction['id'],
                    'code_article': infraction['code_article'],
                    'category': infraction['category'],
                    'description': infraction['description'],
                    'amount_min': amount_min,
                    'amount_max': amount_max,
                    'amende_moyenne': amende_moyenne
                })
            
            return JsonResponse({
                'success': True,
                'infractions': infractions_list
            })
            
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des infractions: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Méthode non autorisée'}, status=405)


@login_required
@permission_required('detection.add_detection', raise_exception=True)
def emettre_amende(request):
    """Émet une amende pour un véhicule détecté"""
    if request.method == 'POST':
        try:
            import json
            from datetime import datetime, timedelta
            from .models import Infraction, Amende, Detection
            from vehicules.models import Vehicle  # Import manquant !
            
            data = json.loads(request.body)
            
            # Récupérer les données
            vehicle_id = data.get('vehicle_id')
            infraction_id = data.get('infraction_id')
            lieu_infraction = data.get('lieu_infraction', '')
            observations = data.get('observations', '')
            detection_id = data.get('detection_id')
            latitude = data.get('latitude')
            longitude = data.get('longitude')
            
            # Validation
            if not all([vehicle_id, infraction_id]):
                return JsonResponse({
                    'error': 'Véhicule et infraction requis'
                }, status=400)
            
            # Récupérer les objets
            try:
                vehicle = Vehicle.objects.get(id=vehicle_id)
                infraction = Infraction.objects.get(id=infraction_id)
                detection = None
                if detection_id:
                    detection = Detection.objects.get(id=detection_id)
            except (Vehicle.DoesNotExist, Infraction.DoesNotExist, Detection.DoesNotExist) as e:
                return JsonResponse({'error': 'Objet non trouvé'}, status=404)
            
            # Vérifier que l'infraction a une amende
            if not infraction.has_amende():
                return JsonResponse({
                    'error': 'Cette infraction n\'a pas d\'amende définie'
                }, status=400)
            
            # Créer l'amende
            amende = Amende.objects.create(
                detection=detection,
                infraction=infraction,
                vehicle=vehicle,
                agent=request.user,
                lieu_infraction=lieu_infraction,
                latitude=latitude,
                longitude=longitude,
                observations=observations,
                date_limite_paiement=datetime.now().date() + timedelta(days=30)
            )
            
            # Envoyer l'email au propriétaire
            try:
                email_sent = send_amende_email(amende)
                if email_sent:
                    amende.email_envoye = True
                    amende.save()
            except Exception as e:
                logger.error(f"Erreur envoi email amende: {str(e)}")
                # On continue même si l'email échoue
            
            return JsonResponse({
                'success': True,
                'message': f'Amende {amende.numero_amende} émise avec succès',
                'amende': {
                    'numero': amende.numero_amende,
                    'montant': float(amende.montant),
                    'infraction': infraction.description,
                    'date_emission': amende.date_emission.strftime('%d/%m/%Y %H:%M'),
                    'date_limite': amende.date_limite_paiement.strftime('%d/%m/%Y'),
                    'email_envoye': amende.email_envoye
                }
            })
            
        except Exception as e:
            logger.error(f"Erreur lors de l'émission d'amende: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Méthode non autorisée'}, status=405)


def send_amende_email(amende):
    """Envoie un email de notification d'amende au propriétaire du véhicule"""
    try:
        from django.core.mail import send_mail
        from django.template.loader import render_to_string
        from django.utils.html import strip_tags
        
        # Préparer le contexte pour le template
        context = {
            'amende': amende,
            'vehicle': amende.vehicle,
            'owner': amende.vehicle.owner,
            'infraction': amende.infraction,
            'agent': amende.agent
        }
        
        # Générer le contenu HTML et texte
        html_message = render_to_string('detection/emails/amende_notification.html', context)
        plain_message = render_to_string('detection/emails/amende_notification.txt', context)
        
        # Envoyer l'email
        send_mail(
            subject=f'Amende de circulation - {amende.numero_amende}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[amende.vehicle.owner.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f"Email d'amende envoyé avec succès pour {amende.numero_amende}")
        return True
        
    except Exception as e:
        logger.error(f"Erreur lors de l'envoi de l'email d'amende: {str(e)}")
        return False

