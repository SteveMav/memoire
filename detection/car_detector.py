import os
import cv2
import numpy as np
from ultralytics import YOLO
from django.conf import settings
import re
import logging

logger = logging.getLogger(__name__)

class CarDetector:
    def __init__(self):
        # Chemins des modèles
        self.vehicle_model_path = os.path.join(settings.BASE_DIR, 'yolov8n.pt')
        self.plate_model_path = os.path.join(settings.BASE_DIR, 'best.pt')
        self.ocr_model_path = os.path.join(settings.BASE_DIR, 'ocr_yolov8_best.pt')

        if not os.path.exists(self.vehicle_model_path):
            logger.error(f"Modèle véhicule non trouvé: {self.vehicle_model_path}")
            raise FileNotFoundError(f"Modèle véhicule non trouvé: {self.vehicle_model_path}")
        if not os.path.exists(self.plate_model_path):
            logger.error(f"Modèle plaque non trouvé: {self.plate_model_path}")
            raise FileNotFoundError(f"Modèle plaque non trouvé: {self.plate_model_path}")
        if not os.path.exists(self.ocr_model_path):
            logger.error(f"Modèle OCR non trouvé: {self.ocr_model_path}")
            raise FileNotFoundError(f"Modèle OCR non trouvé: {self.ocr_model_path}")

        try:
            self.vehicle_model = YOLO(self.vehicle_model_path)
            self.plate_model = YOLO(self.plate_model_path)
            self.ocr_model = YOLO(self.ocr_model_path)
            logger.info("Modèles YOLO chargés avec succès (véhicule, plaque, OCR)")
        except Exception as e:
            logger.error(f"Erreur lors du chargement des modèles YOLO: {e}")
            raise

        # Mapping des classes ID vers caractères
        self.CLASS_TO_CHAR = {
            0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
            10: 'A', 11: 'B', 12: 'C', 13: 'D', 14: 'E', 15: 'F', 16: 'G', 17: 'H', 18: 'I', 19: 'J',
            20: 'K', 21: 'L', 22: 'M', 23: 'N', 24: 'O', 25: 'P', 26: 'Q', 27: 'R', 28: 'S', 29: 'T',
            30: 'U', 31: 'V', 32: 'W', 33: 'X', 34: 'Y', 35: 'Z'
        }

        self.vehicle_classes = [2, 3, 5, 7]   # car, motorcycle, bus, truck
        # Format strict congolais: 4 chiffres, 2 lettres, 2 chiffres
        self.congolese_plate_pattern = re.compile(r'^\d{4}[A-Z]{2}\d{2}$')

    # ==============================================================================
    # MÉTHODES DE DÉTECTION (NÉCESSAIRES POUR ÉVITER L'ERREUR 'detect_vehicles')
    # ==============================================================================

    def detect_vehicles(self, image):
        """Détecte les véhicules dans l'image."""
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
        """Détecte les plaques d'immatriculation dans une région de véhicule."""
        results = self.plate_model(vehicle_region, conf=0.5, verbose=False)
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

    # ==============================================================================
    # MÉTHODES DE PRÉTRAITEMENT ET OCR
    # ==============================================================================

    def preprocess_plate_for_ocr(self, plate_img):
        """
        Applique les filtres de prétraitement OpenCV sur la plaque pour l'OCR.
        Pipeline optimisé pour le modèle YOLO OCR.
        """
        if plate_img is None or plate_img.size == 0:
            logger.warning("Image de plaque vide reçue pour le pré-traitement.")
            return None

        try:
            # 1. Conversion en niveaux de gris
            gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
            
            # 2. Réduction du bruit avec filtre bilatéral (préserve les bords)
            denoised = cv2.bilateralFilter(gray, 11, 17, 17)
            
            # 3. Améliorer le contraste avec CLAHE
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(denoised)
            
            # 4. Seuillage adaptatif pour isoler les caractères
            threshold = cv2.adaptiveThreshold(
                enhanced, 255, 
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 
                11, 2
            )
            
            # 5. Filtre morphologique pour nettoyer l'image
            kernel = np.ones((2, 2), np.uint8)
            morph = cv2.morphologyEx(threshold, cv2.MORPH_CLOSE, kernel)
            
            # Convertir en BGR pour YOLO (attend 3 canaux)
            morph_bgr = cv2.cvtColor(morph, cv2.COLOR_GRAY2BGR)
            
            return morph_bgr
            
        except Exception as e:
            logger.error(f"Erreur lors du prétraitement de la plaque: {e}")
            return None

    def clean_and_normalize_text(self, text):
        """Nettoie et normalise le texte extrait par OCR."""
        cleaned_text = re.sub(r'[^A-Za-z0-9]', '', text)
        return cleaned_text.upper() 

    def extract_text_with_yolo_ocr(self, plate_img, conf_threshold=0.25):
        """
        Extraction des caractères de la plaque avec le modèle YOLO OCR.
        Applique le prétraitement puis utilise YOLO pour détecter les caractères.
        """
        if plate_img is None or plate_img.size == 0:
            return "", 0.0

        try:
            # Prétraiter l'image de la plaque
            processed_img = self.preprocess_plate_for_ocr(plate_img)
            if processed_img is None:
                return "", 0.0

            # Détecter les caractères avec le modèle YOLO OCR
            results = self.ocr_model(processed_img, conf=conf_threshold, verbose=False)
            
            detections = []
            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())
                        confidence = float(box.conf[0].cpu().numpy())
                        
                        # Convertir l'ID de classe en caractère
                        char = self.CLASS_TO_CHAR.get(class_id, '?')
                        x_center = (x1 + x2) / 2
                        
                        detections.append({
                            'char': char,
                            'confidence': confidence,
                            'x_center': x_center
                        })
            
            # Trier par position X (gauche à droite)
            detections.sort(key=lambda d: d['x_center'])
            
            # Construire le texte
            if not detections:
                return "", 0.0
            
            text = ''.join([d['char'] for d in detections])
            avg_confidence = sum([d['confidence'] for d in detections]) / len(detections)
            
            # Nettoyer et post-traiter
            cleaned_text = self.clean_and_normalize_text(text)
            
            # Supprimer le préfixe 'CGO' si présent
            if cleaned_text.startswith('CGO'):
                cleaned_text = cleaned_text[3:]
            
            corrected_text = self.post_process_ocr_output(cleaned_text)
            
            if self.congolese_plate_pattern.match(corrected_text):
                return corrected_text, avg_confidence
            
            if corrected_text:
                return corrected_text, avg_confidence
            
            return "", 0.0
            
        except Exception as e:
            logger.error(f"Erreur lors de l'extraction OCR YOLO: {e}")
            return "", 0.0

    def extract_text(self, plate_img):
        return self.extract_text_with_yolo_ocr(plate_img)

    def post_process_ocr_output(self, text):
        """
        Correction des erreurs selon le format 0000AA00 (inclut les corrections Z/3 et H/4).
        """
        text = re.sub(r'[^A-Z0-9]', '', text.upper())
        
        # 1. Tenter l'extraction du pattern strict
        match_segments = re.search(r'(\d{4})([A-Z]{2})(\d{2})', text)
        if match_segments:
            return match_segments.group(0)

        corrected_text = ""
        # 2. Appliquer la correction positionnelle si la longueur est 8
        if len(text) == 8:
            for i, char in enumerate(text):
                if i < 4 or i >= 6: # Positions Chiffres (0-3 et 6-7)
                    if char.isdigit():
                        corrected_text += char
                    else:
                        # Convertir les lettres en chiffres
                        if char in ('O', 'D'): corrected_text += '0'
                        elif char in ('I', 'L', 'T'): corrected_text += '1'
                        elif char == 'Z': corrected_text += '3' # Z souvent 3 ou 2
                        elif char == 'A': corrected_text += '4'
                        elif char == 'H': corrected_text += '4' 
                        elif char == 'S': corrected_text += '5'
                        elif char == 'G': corrected_text += '6'
                        elif char == 'B': corrected_text += '8'
                        # Autres lettres sont ignorées
                            
                elif i < 6: # Positions Lettres (4-5)
                    if char.isalpha():
                        corrected_text += char
                    else:
                        # Convertir les chiffres en lettres
                        if char == '0': corrected_text += 'O'
                        elif char == '1': corrected_text += 'I' 
                        elif char == '5': corrected_text += 'S'
                        elif char == '8': corrected_text += 'B'
                        elif char == '4': corrected_text += 'A'
                        # Autres chiffres sont ignorés

            if self.congolese_plate_pattern.match(corrected_text):
                return corrected_text

        
        # 3. Logique d'extraction par segments (dernière tentative)
        digits = re.findall(r'\d', text)
        letters = re.findall(r'[A-Z]', text)

        if len(digits) >= 6 and len(letters) >= 2:
            potential_plate = f"{''.join(digits[:4])}{''.join(letters[:2])}{''.join(digits[4:6])}"
            if self.congolese_plate_pattern.match(potential_plate):
                return potential_plate

        return text 

    # ==============================================================================
    # MÉTHODE PRINCIPALE DE TRAITEMENT
    # ==============================================================================

    def process_detection(self, image_path):
        """Fonction principale pour détecter les véhicules et extraire les plaques."""
        image = cv2.imread(image_path)
        if image is None:
            logger.error(f"Impossible de charger l'image: {image_path}")
            raise ValueError(f"Impossible de charger: {image_path}")
        
        result_image = image.copy()
        detection_results = []

        vehicles = self.detect_vehicles(image)

        for i, vehicle in enumerate(vehicles):
            x1, y1, x2, y2 = vehicle['bbox']

            cv2.rectangle(result_image, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(result_image, f'Vehicle {i+1}', (x1, y1-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            # Marge augmentée pour la région du véhicule
            margin = 20 
            v_x1 = max(0, x1 - margin)
            v_y1 = max(0, y1 - margin)
            v_x2 = min(image.shape[1], x2 + margin)
            v_y2 = min(image.shape[0], y2 + margin)

            vehicle_region = image[v_y1:v_y2, v_x1:v_x2]

            if vehicle_region.size == 0:
                logger.warning(f"Région du véhicule {i+1} est vide, skip.")
                continue

            plates = self.detect_plates(vehicle_region)
            
            vehicle_plates = []
            for j, plate in enumerate(plates):
                px1, py1, px2, py2 = plate['bbox']

                # Marge de 5 pixels ajoutée pour la plaque elle-même
                plate_margin = 5  
                abs_x1 = max(0, v_x1 + px1 - plate_margin)
                abs_y1 = max(0, v_y1 + py1 - plate_margin)
                abs_x2 = min(image.shape[1], v_x1 + px2 + plate_margin)
                abs_y2 = min(image.shape[0], v_y1 + py2 + plate_margin)

                if abs_x2 <= abs_x1 or abs_y2 <= abs_y1:
                    logger.warning(f"Coordonnées de la plaque {j+1} du véhicule {i+1} invalides, skip.")
                    continue

                plate_img = image[abs_y1:abs_y2, abs_x1:abs_x2]

                if plate_img.size == 0:
                    logger.warning(f"Image de la plaque {j+1} du véhicule {i+1} est vide, skip.")
                    continue

                text, confidence = self.extract_text(plate_img)
                
                cv2.rectangle(result_image, (abs_x1, abs_y1), (abs_x2, abs_y2), (0, 0, 255), 2)
                
                display_text = text if text else "N/A"
                cv2.putText(result_image, display_text, (abs_x1, abs_y1 - 10),
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