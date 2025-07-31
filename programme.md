# 📘 Programme Étapes par Étapes – Projet Reconnaissance de Plaques (Django)

## 🔰 Phase 1 : Initialisation

- [ ] Créer un projet Django
- [ ] Créer les apps nécessaires : `users`, `plate_detector`, `vehicles`
- [ ] Configurer la base de données (SQLite ou PostgreSQL)
- [ ] Configurer le système d'authentification utilisateur
- [ ] Créer les modèles et faire les migrations

## 🧱 Phase 2 : Backend de gestion

- [ ] Créer les vues pour gérer :
    - Ajout d’utilisateurs
    - Ajout de véhicules
    - Upload de photos et vidéos
- [ ] Affichage des données dans l’interface admin
- [ ] Protéger les vues par permissions (utilisateur/admin)

## 🧠 Phase 3 : Détection de plaques (Photo)

- [ ] Intégrer OpenCV pour lire l’image
- [ ] Isoler la plaque (traitement d’image)
- [ ] Utiliser Tesseract ou EasyOCR pour reconnaître la plaque
- [ ] Stocker le résultat (plaque reconnue) en base

## 📽️ Phase 4 : Détection de plaques (Vidéo)

- [ ] Extraire des images d'une vidéo (OpenCV)
- [ ] Traiter chaque image pour détecter une plaque
- [ ] Détecter la meilleure plaque (score OCR ou taille)
- [ ] Stocker le résultat

## 🌐 Phase 5 : Interface web

- [ ] Formulaire d’upload (image ou vidéo)
- [ ] Affichage des résultats de détection
- [ ] Interface admin pour consulter les logs, utilisateurs, véhicules
- [ ] Page de recherche (par plaque ou propriétaire)

## 🧪 Phase 6 : Tests et améliorations

- [ ] Améliorer la précision OCR (prétraitement, filtres)
- [ ] Gérer les erreurs et cas limites (plaque floue, absente…)
- [ ] Ajouter des tests unitaires (si temps)
- [ ] Nettoyage automatique des fichiers uploadés

