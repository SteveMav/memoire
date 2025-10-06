import os
import cv2
import numpy as np
import pytesseract
import torch
from ultralytics import YOLO
from django.conf import settings
import re
import logging

logger = logging.getLogger(__name__)

class CarDetector:
    def __init__(self):
        self.vehicle_model_path = os.path.join(settings.BASE_DIR, 'yolov8n.pt')
        self.plate_model_path = os.path.join(settings.BASE_DIR, 'best.pt')

        if not os.path.exists(self.vehicle_model_path):
            logger.error(f"Modèle véhicule non trouvé: {self.vehicle_model_path}")
            raise FileNotFoundError(f"Modèle véhicule non trouvé: {self.vehicle_model_path}")
        if not os.path.exists(self.plate_model_path):
            logger.error(f"Modèle plaque non trouvé: {self.plate_model_path}")
            raise FileNotFoundError(f"Modèle plaque non trouvé: {self.plate_model_path}")

        try:
            self.vehicle_model = YOLO(self.vehicle_model_path)
            self.plate_model = YOLO(self.plate_model_path)
        except Exception as e:
            logger.error(f"Erreur lors du chargement des modèles YOLO: {e}")
            raise

        try:
            # Configuration Pytesseract
            # Définir le chemin vers tesseract si nécessaire (Windows)
            pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
            
            # Configuration OCR pour plaques d'immatriculation
            self.tesseract_config = '--psm 8 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
            logger.info("Pytesseract initialisé avec succès")
        except Exception as e:
            logger.error(f"Erreur lors de l'initialisation de Pytesseract: {e}")
            raise

        self.vehicle_classes = [2, 3, 5, 7]  # car, motorcycle, bus, truck
        self.congolese_plate_pattern = re.compile(r'^\d{4}[A-Z]{2}\d{2}$')
        # Un pattern plus flexible pour l'extraction initiale
        self.flexible_plate_pattern = re.compile(r'\d{3,}[A-Z]{1,}\d{1,}') # Au moins 3 chiffres, 1 lettre, 1 chiffre

    def detect_vehicles(self, image):
        # Le reste de cette fonction reste inchangé car elle n'est pas la source du problème
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
        # On pourrait ajuster le conf ici aussi si 'best.pt' est optimisé pour ces plaques
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

    def preprocess_plate_simple(self, plate_img):
        """
        Préprocesse l'image de plaque avec une approche simplifiée :
        1. Conversion en niveaux de gris
        2. Filtre bilatéral pour réduire le bruit tout en préservant les contours
        3. Seuillage adaptatif pour conversion en binaire
        """
        if plate_img is None or plate_img.size == 0:
            logger.warning("Image de plaque vide reçue pour le pré-traitement.")
            return None

        # ÉTAPE 1: Conversion en niveaux de gris
        gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
        
        h, w = gray.shape
        if h == 0 or w == 0:
            return None

        # ÉTAPE 2: Filtre bilatéral pour réduire le bruit tout en gardant les contours nets
        gray = cv2.bilateralFilter(gray, 9, 75, 75)

        # ÉTAPE 3: Seuillage adaptatif pour conversion en binaire
        # Utilise une fenêtre adaptative pour gérer les variations d'éclairage
        binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                      cv2.THRESH_BINARY, 11, 2)

        return binary


    def clean_and_normalize_text(self, text):
        """Nettoie et normalise le texte extrait par OCR."""
        # Comme vous l'avez mentionné, tout est en majuscules.
        # S'assurer que les espaces ou autres caractères non-alphanumériques sont supprimés.
        cleaned_text = re.sub(r'[^A-Z0-9]', '', text.upper())
        return cleaned_text


    def extract_text_simple(self, plate_img):
        """
        ÉTAPE 3: Extraction des caractères de la plaque après preprocessing.
        Utilise Pytesseract sur l'image binaire pour extraire le texte.
        """
        # Préprocesser l'image (gris -> binaire)
        processed = self.preprocess_plate_simple(plate_img)
        if processed is None:
            return "", 0.0

        try:
            # Extraction du texte avec Pytesseract
            # Configuration optimisée pour plaques d'immatriculation
            text = pytesseract.image_to_string(processed, config=self.tesseract_config).strip()
            
            # Obtenir la confiance
            data = pytesseract.image_to_data(processed, config=self.tesseract_config, output_type=pytesseract.Output.DICT)
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            if text:
                # Nettoyer le texte extrait
                cleaned_text = self.clean_and_normalize_text(text)
                
                # Supprimer le préfixe 'CGO' si présent
                if cleaned_text.startswith('CGO'):
                    cleaned_text = cleaned_text[3:]
                
                # Essayer d'extraire le format congolais
                plate_text = self.extract_congolese_format(cleaned_text)
                if plate_text:
                    return plate_text, avg_confidence / 100.0
                
                # Post-traitement si format strict non trouvé
                corrected_text = self.post_process_ocr_output(cleaned_text)
                if self.congolese_plate_pattern.match(corrected_text):
                    return corrected_text, avg_confidence / 100.0
                
                # Retourner le texte nettoyé même s'il ne correspond pas au format
                if cleaned_text:
                    return cleaned_text, avg_confidence / 100.0
            
            return "", 0.0
            
        except Exception as e:
            logger.error(f"Erreur lors de l'extraction OCR: {e}")
            return "", 0.0


    def extract_text(self, plate_img):
        """
        Fonction principale d'extraction de texte selon le processus simplifié :
        1. Conversion en niveaux de gris
        2. Conversion en binaire  
        3. Extraction des caractères avec OCR
        """
        try:
            return self.extract_text_simple(plate_img)
        except Exception as e:
            logger.error(f"Erreur lors de l'extraction OCR: {e}")
            return "", 0.0

    def extract_congolese_format(self, text):
        match = self.congolese_plate_pattern.match(text)
        if match:
            return match.group(0)
        return ""

    def post_process_ocr_output(self, text):
        """
        Fonction pour post-traiter le texte OCR selon le format congolais 0000AA00.
        Applique les corrections de caractères selon leur position attendue.
        """
        # Nettoyer le texte d'abord
        text = re.sub(r'[^A-Z0-9]', '', text.upper())
        
        # Si le texte fait exactement 8 caractères, appliquer les corrections par position
        if len(text) == 8:
            corrected_text = ""
            
            for i, char in enumerate(text):
                if i < 4:  # Positions 0-3: doivent être des chiffres
                    if char.isdigit():
                        corrected_text += char
                    else:
                        # Convertir les lettres en chiffres pour les 4 premières positions
                        if char == 'O':
                            corrected_text += '0'
                        elif char == 'I' or char == 'L':
                            corrected_text += '1'
                        elif char == 'Z':
                            corrected_text += '2'
                        elif char == 'S':
                            corrected_text += '5'
                        elif char == 'G':
                            corrected_text += '6'
                        elif char == 'B':
                            corrected_text += '8'
                        else:
                            corrected_text += char  # Garder le caractère original si pas de règle
                            
                elif i < 6:  # Positions 4-5: doivent être des lettres
                    if char.isalpha():
                        corrected_text += char
                    else:
                        # Convertir les chiffres en lettres pour les positions 4-5
                        if char == '0':
                            corrected_text += 'O'
                        elif char == '1':
                            corrected_text += 'I'
                        elif char == '2':
                            corrected_text += 'Z'
                        elif char == '5':
                            corrected_text += 'S'
                        elif char == '6':
                            corrected_text += 'G'
                        elif char == '8':
                            corrected_text += 'B'
                        else:
                            corrected_text += char  # Garder le caractère original si pas de règle
                            
                else:  # Positions 6-7: doivent être des chiffres
                    if char.isdigit():
                        corrected_text += char
                    else:
                        # Convertir les lettres en chiffres pour les 2 dernières positions
                        if char == 'O':
                            corrected_text += '0'
                        elif char == 'I' or char == 'L':
                            corrected_text += '1'
                        elif char == 'Z':
                            corrected_text += '2'
                        elif char == 'S':
                            corrected_text += '5'
                        elif char == 'G':
                            corrected_text += '6'
                        elif char == 'B':
                            corrected_text += '8'
                        else:
                            corrected_text += char  # Garder le caractère original si pas de règle
            
            # Vérifier si le texte corrigé correspond au format
            if self.congolese_plate_pattern.match(corrected_text):
                return corrected_text
        
        # Si le texte ne fait pas 8 caractères, essayer de reconstruire le format
        # Extraire tous les chiffres et lettres
        digits = re.findall(r'\d', text)
        letters = re.findall(r'[A-Z]', text)

        # Essayer de former le pattern 4 chiffres + 2 lettres + 2 chiffres
        if len(digits) >= 6 and len(letters) >= 2:
            potential_plate = f"{''.join(digits[:4])}{''.join(letters[:2])}{''.join(digits[4:6])}"
            if self.congolese_plate_pattern.match(potential_plate):
                return potential_plate
        
        # Vérifier si le format est déjà correct après nettoyage
        match_segments = re.search(r'(\d{4})([A-Z]{2})(\d{2})', text)
        if match_segments:
            return match_segments.group(0)

        return text  # Retourner le texte original si aucune correction n'est possible

    def process_detection(self, image_path):
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
            
            # Augmenter la marge pour capturer la totalité de la plaque,
            # surtout si le modèle YOLO la coupe un peu.
            margin = 20 # Marge augmentée pour les plaques (à ajuster)
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

                abs_x1 = v_x1 + px1
                abs_y1 = v_y1 + py1
                abs_x2 = v_x1 + px2
                abs_y2 = v_y1 + py2
                
                abs_x1 = max(0, abs_x1)
                abs_y1 = max(0, abs_y1)
                abs_x2 = min(image.shape[1], abs_x2)
                abs_y2 = min(image.shape[0], abs_y2)

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