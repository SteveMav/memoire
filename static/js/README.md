# Structure des fichiers JavaScript

## Séparation des responsabilités

### `detection.js` - Détection et extraction de plaques
**Responsabilités :**
- Upload et prévisualisation d'images
- Détection automatique des véhicules et plaques
- Extraction manuelle de plaques (sélection par glisser-déposer)
- Correction des textes de plaques détectées
- Sauvegarde simple des plaques corrigées
- Gestion du drag & drop
- Interface de sélection manuelle

**Fonctions principales :**
- `displayResults()` - Affichage des résultats de détection
- `saveCorrectedPlates()` - Sauvegarde des corrections (ancienne version complète)
- `savePlatesOnly()` - Sauvegarde simplifiée
- `enableManualSelection()` - Activation de la sélection manuelle
- `extractManualPlate()` - Extraction de plaque sélectionnée manuellement

### `verification.js` - Vérification des véhicules et propriétaires
**Responsabilités :**
- Vérification des plaques dans la base de données
- Recherche des informations véhicule et propriétaire
- Affichage des résultats de vérification
- Interface de consultation des données

**Fonctions principales :**
- `verifyVehicles()` - Vérification des véhicules via API
- `displayVehicleVerificationResults()` - Affichage des résultats détaillés
- `testVerifyButton()` - Test du bouton de vérification
- `testDirectVerify()` - Test direct de l'API de vérification

## Flux d'utilisation

1. **Détection** (`detection.js`)
   - Upload image → détection → correction des textes

2. **Vérification** (`verification.js`)  
   - Clic "Vérifier" → recherche en base → affichage des infos

3. **Sauvegarde** (`detection.js`)
   - Clic "Sauvegarder" → enregistrement des données

## Intégration

Les deux fichiers sont chargés dans le template `home_detect.html` :
```html
<script src="{% static 'js/detection.js' %}"></script>
<script src="{% static 'js/verification.js' %}"></script>
```

Les fonctions de vérification sont appelées depuis `detection.js` mais définies dans `verification.js`.
