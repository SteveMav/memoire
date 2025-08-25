import os
import cv2
import numpy as np
from django.conf import settings
from django.shortcuts import render, redirect
from django.core.files.storage import FileSystemStorage
from django.http import JsonResponse
from .car_detector import CarDetector

# Créer une instance du détecteur
detector = CarDetector()

def detect_home(request):
    """Page d'accueil avec détection de véhicules et de plaques"""
    if request.method == 'POST' and request.FILES.get('media'):
        # Vérifier si c'est une requête AJAX
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        
        try:
            # Enregistrer le fichier téléchargé
            uploaded_file = request.FILES['media']
            fs = FileSystemStorage()
            filename = fs.save(uploaded_file.name, uploaded_file)
            file_path = os.path.join(settings.MEDIA_ROOT, filename)
            
            # Vérifier si c'est une image
            if not uploaded_file.content_type.startswith('image'):
                if is_ajax:
                    return JsonResponse({'error': 'Seules les images sont prises en charge pour le moment.'}, status=400)
                return render(request, 'detection/home_detect.html', {'error': 'Seules les images sont prises en charge pour le moment.'})
            
            # Détecter les voitures
            result_image, cars = detector.detect_cars(file_path)
            
            # Liste pour stocker les résultats des plaques
            plates_data = []
            
            # Pour chaque voiture détectée, essayer de détecter la plaque
            for i, car in enumerate(cars):
                x1, y1, x2, y2 = car['box']
                car_roi = cv2.imread(file_path)[y1:y2, x1:x2]
                
                # Détecter la plaque
                plate = detector.detect_plate(car_roi)
                
                if plate is not None:
                    # Extraire la région de la plaque
                    x, y, w, h = cv2.boundingRect(plate)
                    plate_roi = car_roi[y:y+h, x:x+w]
                    
                    # Extraire le texte de la plaque
                    plate_text = detector.extract_plate_text(plate_roi)
                    
                    # Enregistrer les résultats
                    plate_filename = f"plate_{i}_{filename}"
                    plate_path = os.path.join(settings.MEDIA_ROOT, plate_filename)
                    cv2.imwrite(plate_path, plate_roi)
                    
                    plates_data.append({
                        'plate_image': fs.url(plate_filename).lstrip('/'),
                        'plate_text': plate_text if plate_text else "Aucun texte détecté"
                    })
            
            # Enregistrer l'image avec les détections
            result_filename = f"detection_{filename}"
            result_path = os.path.join(settings.MEDIA_ROOT, result_filename)
            cv2.imwrite(result_path, result_image)
            
            # Préparer la réponse
            response_data = {
                'original_image': fs.url(filename).lstrip('/'),
                'processed_image': fs.url(result_filename).lstrip('/'),
                'cars_detected': len(cars),
                'plates': plates_data,
                'success': True
            }
            
            if is_ajax:
                return JsonResponse(response_data)
                
            return render(request, 'detection/home_detect.html', response_data)
            
        except Exception as e:
            error_msg = f"Une erreur s'est produite lors de la détection : {str(e)}"
            if is_ajax:
                return JsonResponse({'error': error_msg}, status=500)
            return render(request, 'detection/home_detect.html', {'error': error_msg})
    
    # Si ce n'est pas une requête POST, afficher simplement la page
    return render(request, 'detection/home_detect.html')

# def detect_vehicle(request):
#     """Vue pour gérer la détection de véhicules et de plaques"""
#     context = {}
    
#     if request.method == 'POST' and request.FILES.get('image'):
#         # Enregistrer le fichier téléchargé
#         uploaded_file = request.FILES['image']
#         fs = FileSystemStorage()
#         filename = fs.save(uploaded_file.name, uploaded_file)
#         uploaded_file_url = fs.url(filename)
        
#         # Chemin complet du fichier
#         file_path = os.path.join(settings.MEDIA_ROOT, filename)
        
#         try:
#             # Détecter les voitures
#             result_image, cars = detector.detect_cars(file_path)
            
#             # Liste pour stocker les résultats des plaques
#             plates_data = []
            
#             # Pour chaque voiture détectée, essayer de détecter la plaque
#             for i, car in enumerate(cars):
#                 x1, y1, x2, y2 = car['box']
#                 car_roi = cv2.imread(file_path)[y1:y2, x1:x2]
                
#                 # Détecter la plaque
#                 plate = detector.detect_plate(car_roi)
                
#                 if plate is not None:
#                     # Extraire la région de la plaque
#                     x, y, w, h = cv2.boundingRect(plate)
#                     plate_roi = car_roi[y:y+h, x:x+w]
                    
#                     # Extraire le texte de la plaque
#                     plate_text = detector.extract_plate_text(plate_roi)
                    
#                     # Enregistrer les résultats
#                     plate_path = f"plate_{i}.jpg"
#                     cv2.imwrite(os.path.join(settings.MEDIA_ROOT, plate_path), plate_roi)
                    
#                     plates_data.append({
#                         'plate_image': fs.url(plate_path),
#                         'plate_text': plate_text
#                     })
            
#             # Enregistrer l'image avec les détections
#             result_path = f"detection_{filename}"
#             cv2.imwrite(os.path.join(settings.MEDIA_ROOT, result_path), result_image)
            
#             context.update({
#                 'original_image': uploaded_file_url,
#                 'processed_image': fs.url(result_path),
#                 'cars_detected': len(cars),
#                 'plates': plates_data
#             })
            
#         except Exception as e:
#             context['error'] = f"Une erreur s'est produite: {str(e)}"
    
#     return render(request, 'detection/detect.html', context)


# def detect_vehicle(request):
#     context = {}

#     if request.method == 'POST' and request.FILES.get('media'):
#         uploaded_file = request.FILES['media']
#         fs = FileSystemStorage()
#         file_path = fs.save(uploaded_file.name, uploaded_file)
#         full_path = os.path.join(settings.MEDIA_ROOT, file_path)

#         # Charger le modèle YOLO
#         model = YOLO("yolov8n.pt")  # modèle léger (~6 Mo)

#         # Faire la détection
#         results = model(full_path)

#         # Sauvegarder le fichier annoté
#         output_path = os.path.join(settings.MEDIA_ROOT, f"detected_{uploaded_file.name}")
#         results[0].save(filename=output_path)

#         context['uploaded_file_url'] = fs.url(file_path)
#         context['output_file_url'] = fs.url(f"detected_{uploaded_file.name}")

#     return render(request, 'detection/detect.html', context)




