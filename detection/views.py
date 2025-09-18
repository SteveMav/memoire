import os
import cv2
from django.conf import settings
from django.shortcuts import render
from django.core.files.storage import FileSystemStorage
from django.http import JsonResponse
from .car_detector import CarDetector
from django.contrib.auth.decorators import login_required, permission_required
from vehicules.models import Vehicle


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
                    entry.update({
                        'found': True,
                        'vehicle': {
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
                    entry.update({
                        'found': False,
                        'message': 'Aucun véhicule trouvé pour cette plaque'
                    })

                matches.append(entry)
            
            return JsonResponse({
                'success': True,
                'message': f'{len(corrected_plates)} plaque(s) sauvegardée(s) avec succès',
                'plates': corrected_plates,
                'matches': matches
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
            
            # Charger l'image originale
            full_image_path = os.path.join(settings.MEDIA_ROOT, image_path)
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

