import cv2
import numpy as np
import easyocr
from ultralytics import YOLO
import os

class CarDetector:
    def __init__(self):
        # Charger le modèle YOLO pour la détection de voitures
        self.car_model = YOLO('yolov8n.pt')  # Modèle pré-entraîné sur COCO
        
        # Charger le modèle pour la détection de plaques d'immatriculation
        # Note: Vous devrez peut-être télécharger un modèle spécifique pour les plaques
        self.plate_model = YOLO('yolov8n.pt')  # À remplacer par un modèle spécifique si disponible
        
        # Initialiser le lecteur OCR pour l'extraction de texte
        self.reader = easyocr.Reader(['fr'])
    
    def detect_cars(self, image_path):
        """
        Détecte les voitures dans une image
        Retourne l'image avec les boîtes englobantes et la liste des voitures détectées
        """
        # Lire l'image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("Impossible de charger l'image")
        
        # Détecter les voitures (classe 2: voiture, 5: bus, 7: camion dans COCO)
        results = self.car_model(image, classes=[2, 5, 7])
        
        # Liste pour stocker les coordonnées des voitures détectées
        cars = []
        
        # Dessiner les boîtes englobantes et extraire les régions d'intérêt
        for result in results[0].boxes.data.tolist():
            x1, y1, x2, y2, score, class_id = result
            if score > 0.5:  # Seuil de confiance
                cars.append({
                    'box': (int(x1), int(y1), int(x2), int(y2)),
                    'score': float(score),
                    'class_id': int(class_id)
                })
                # Dessiner la boîte englobante
                cv2.rectangle(image, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
        
        return image, cars
    
    def detect_plate(self, car_image):
        """
        Détecte les plaques d'immatriculation dans une image de voiture
        """
        # Redimensionner l'image pour un traitement plus rapide et plus stable
        height, width = car_image.shape[:2]
        scale = 600.0 / width
        resized = cv2.resize(car_image, (600, int(height * scale)))
        
        # Convertir en niveaux de gris
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        
        # Améliorer le contraste avec CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        gray = clahe.apply(gray)
        
        # Réduire le bruit avec un flou bilatéral qui préserve les bords
        blurred = cv2.bilateralFilter(gray, 11, 17, 17)
        
        # Détection des bords avec Canny
        edges = cv2.Canny(blurred, 30, 200)
        
        # Trouver les contours
        contours, _ = cv2.findContours(edges.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        # Trier les contours par aire (du plus grand au plus petit) et ne garder que les plus grands
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]
        
        # Chercher la plaque (un rectangle avec un bon ratio largeur/hauteur)
        plate_contour = None
        
        # Dimensions de l'image pour calculer les ratios
        height, width = gray.shape
        min_area = (width * height) * 0.01  # Au moins 1% de l'image
        
        for contour in contours:
            # Ignorer les contours trop petits
            if cv2.contourArea(contour) < min_area:
                continue
                
            # Approximation du contour
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            
            # Si on a un quadrilatère
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(approx)
                aspect_ratio = float(w) / h
                
                # Vérifier le ratio d'aspect typique d'une plaque (environ 2:1 ou 4:1)
                if 1.5 <= aspect_ratio <= 5.0:
                    # Vérifier la solidité (ratio aire/convexe)
                    hull = cv2.convexHull(contour)
                    solidity = cv2.contourArea(contour) / cv2.contourArea(hull) if cv2.contourArea(hull) > 0 else 0
                    
                    # Vérifier l'étendue (rapport entre l'aire du contour et sa boîte englobante)
                    rect_area = w * h
                    extent = cv2.contourArea(contour) / rect_area if rect_area > 0 else 0
                    
                    if solidity > 0.7 and extent > 0.6:  # Seuils ajustables
                        plate_contour = approx
                        break
        
        # Si on a trouvé un contour, on le redimensionne aux dimensions originales
        if plate_contour is not None:
            plate_contour = plate_contour * (1/scale)
            plate_contour = plate_contour.astype(int)
            
        return plate_contour
    
    def extract_plate_text(self, plate_image):
        """
        Extrait le texte d'une image de plaque d'immatriculation avec prétraitement amélioré
        """
        # Redimensionner l'image pour une meilleure reconnaissance
        height, width = plate_image.shape[:2]
        scale = 300.0 / width
        resized = cv2.resize(plate_image, (300, int(height * scale)))
        
        # Convertir en niveaux de gris
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        
        # Améliorer le contraste
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        # Seuillage adaptatif
        thresh = cv2.adaptiveThreshold(
            enhanced, 255, 
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 
            11, 2
        )
        
        # Utiliser EasyOCR avec des paramètres optimisés
        results = self.reader.readtext(
            thresh,
            decoder='beamsearch',
            beamWidth=5,
            batch_size=1,
            workers=0,
            allowlist='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ- ',
            width_ths=0.7,
            height_ths=0.7,
            y_ths=0.7,
            paragraph=False
        )
        
        # Traiter les résultats
        if results:
            # Trier par position X (de gauche à droite)
            results.sort(key=lambda x: x[0][0][0])
            
            # Extraire le texte avec une confiance minimale de 30%
            plate_text = ' '.join([
                result[1] 
                for result in results 
                if result[2] > 0.3  # Seuil de confiance
            ])
            
            # Nettoyer le texte
            import re
            plate_text = re.sub(r'[^A-Z0-9- ]', '', plate_text.upper())
            plate_text = re.sub(r'\s+', ' ', plate_text).strip()
            
            return plate_text if plate_text else None
        
        return None
