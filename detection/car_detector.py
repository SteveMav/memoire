import os
import cv2
import numpy as np
import easyocr
import torch
from ultralytics import YOLO
from django.conf import settings
import re


class CarDetector:
    def __init__(self):
        """Initialise le détecteur avec les modèles YOLO"""
        # Chemins vers les modèles
        self.vehicle_model_path = os.path.join(settings.BASE_DIR, 'yolov8n.pt')
        self.plate_model_path = os.path.join(settings.BASE_DIR, 'best.pt')
        
        # Vérifier que les modèles existent
        if not os.path.exists(self.vehicle_model_path):
            raise FileNotFoundError(f"Modèle véhicule non trouvé: {self.vehicle_model_path}")
        if not os.path.exists(self.plate_model_path):
            raise FileNotFoundError(f"Modèle plaque non trouvé: {self.plate_model_path}")
        
        # Charger les modèles
        self.vehicle_model = YOLO(self.vehicle_model_path)
        self.plate_model = YOLO(self.plate_model_path)
        
        # Initialiser EasyOCR
        self.ocr_reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available())
        
        # Classes de véhicules COCO
        self.vehicle_classes = [2, 3, 5, 7]  # car, motorcycle, bus, truck
    
    def detect_vehicles(self, image):
        """Détecte les véhicules"""
        results = self.vehicle_model(image, conf=0.4, verbose=False)
        vehicles = []
        
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    if class_id in self.vehicle_classes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                        confidence = float(box.conf[0])
                        
                        vehicles.append({
                            'bbox': [x1, y1, x2, y2],
                            'confidence': confidence,
                            'class_id': class_id
                        })
        
        return vehicles
    
    def detect_plates(self, vehicle_region):
        """Détecte les plaques dans une région"""
        results = self.plate_model(vehicle_region, conf=0.25, verbose=False)
        plates = []
        
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                    confidence = float(box.conf[0])
                    
                    plates.append({
                        'bbox': [x1, y1, x2, y2],
                        'confidence': confidence
                    })
        
        return plates
    
    def preprocess_plate(self, plate_img):
        """Préprocesse l'image de plaque"""
        if plate_img.size == 0:
            return None
            
        # Convertir en gris
        gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
        
        # Redimensionner si trop petit
        h, w = gray.shape
        if h < 40 or w < 120:
            scale = max(40/h, 120/w)
            new_w, new_h = int(w * scale), int(h * scale)
            gray = cv2.resize(gray, (new_w, new_h))
        
        # Améliorer le contraste
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        
        # Débruitage
        denoised = cv2.fastNlMeansDenoising(enhanced)
        
        return denoised
    
    def extract_text(self, plate_img):
        """Extrait le texte avec OCR pour plaques congolaises"""
        processed = self.preprocess_plate(plate_img)
        if processed is None:
            return "", 0.0
        
        try:
            results = self.ocr_reader.readtext(processed, detail=1)
            if not results:
                return "", 0.0
            
            # Combiner tous les textes détectés
            all_text = ""
            for result in results:
                text_part = re.sub(r'[^A-Z0-9]', '', result[1].upper())
                all_text += text_part
            
            # Supprimer le préfixe CGO s'il existe
            if all_text.startswith('CGO'):
                all_text = all_text[3:]
            
            # Extraire le format congolais: 4 chiffres + 2 lettres + 2 chiffres
            plate_text = self.extract_congolese_format(all_text)
            
            if plate_text:
                # Calculer la confiance moyenne
                avg_confidence = sum(r[2] for r in results) / len(results)
                return plate_text, avg_confidence
            
            # Si pas de format valide, retourner le texte nettoyé
            return all_text, results[0][2] if results else 0.0
            
        except Exception:
            return "", 0.0
    
    def extract_congolese_format(self, text):
        """Extrait le format congolais: 4 chiffres + 2 lettres + 2 chiffres"""
        # Chercher le pattern exact: 4 chiffres + 2 lettres + 2 chiffres
        pattern = r'([0-9]{4}[A-Z]{2}[0-9]{2})'
        match = re.search(pattern, text)
        
        if match:
            return match.group(1)
        
        # Si pas de match exact, essayer de construire le format
        # Extraire tous les chiffres et lettres séparément
        digits = re.findall(r'[0-9]', text)
        letters = re.findall(r'[A-Z]', text)
        
        # Vérifier si on a assez d'éléments (6 chiffres + 2 lettres minimum)
        if len(digits) >= 6 and len(letters) >= 2:
            # Construire: 4 premiers chiffres + 2 premières lettres + 2 derniers chiffres
            first_four = ''.join(digits[:4])
            two_letters = ''.join(letters[:2])
            last_two = ''.join(digits[4:6])
            
            constructed = first_four + two_letters + last_two
            return constructed
        
        return ""
    
    def process_detection(self, image_path):
        """Processus principal de détection"""
        # Charger l'image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Impossible de charger: {image_path}")
        
        result_image = image.copy()
        detection_results = []
        
        # Détecter les véhicules
        vehicles = self.detect_vehicles(image)
        
        for i, vehicle in enumerate(vehicles):
            x1, y1, x2, y2 = vehicle['bbox']
            
            # Dessiner le véhicule
            cv2.rectangle(result_image, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(result_image, f'Vehicle {i+1}', (x1, y1-10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            # Extraire la région du véhicule
            vehicle_region = image[y1:y2, x1:x2]
            
            if vehicle_region.size == 0:
                continue
            
            # Détecter les plaques
            plates = self.detect_plates(vehicle_region)
            
            vehicle_plates = []
            for j, plate in enumerate(plates):
                px1, py1, px2, py2 = plate['bbox']
                
                # Coordonnées absolues
                abs_x1 = x1 + px1
                abs_y1 = y1 + py1
                abs_x2 = x1 + px2
                abs_y2 = y1 + py2
                
                # Vérifier les limites
                abs_x1 = max(0, abs_x1)
                abs_y1 = max(0, abs_y1)
                abs_x2 = min(image.shape[1], abs_x2)
                abs_y2 = min(image.shape[0], abs_y2)
                
                if abs_x2 <= abs_x1 or abs_y2 <= abs_y1:
                    continue
                
                # Extraire la plaque
                plate_img = image[abs_y1:abs_y2, abs_x1:abs_x2]
                
                if plate_img.size == 0:
                    continue
                
                # OCR
                text, confidence = self.extract_text(plate_img)
                
                # Dessiner la plaque
                cv2.rectangle(result_image, (abs_x1, abs_y1), (abs_x2, abs_y2), (0, 0, 255), 2)
                
                if text:
                    cv2.putText(result_image, text, (abs_x1, abs_y1-10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                
                vehicle_plates.append({
                    'image': plate_img,
                    'text': text,
                    'confidence': confidence,
                    'bbox': [abs_x1, abs_y1, abs_x2, abs_y2]
                })
            
            detection_results.append({
                'vehicle_bbox': vehicle['bbox'],
                'vehicle_confidence': vehicle['confidence'],
                'plates': vehicle_plates
            })
        
        return result_image, detection_results