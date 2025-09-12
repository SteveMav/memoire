// Version 2.0 - Système de correction de plaques
document.addEventListener('DOMContentLoaded', function() {
    console.log('Detection JS v2.0 loaded');
    
    const dropArea = document.getElementById('dropArea');
    const mediaInput = document.getElementById('mediaInput');
    const preview = document.getElementById('preview');
    const uploadForm = document.getElementById('uploadForm');
    const resultsSection = document.getElementById('resultsSection');
    
    // Configuration pour images uniquement
    mediaInput.accept = 'image/*';

    // Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
    });

    dropArea.addEventListener('drop', handleDrop, false);
    mediaInput.addEventListener('change', handleFiles);

    function handleDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length) handleFiles({ target: { files } });
    }

    function handleFiles(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.type.startsWith('image/')) {
            displayPreview(file);
        } else {
            alert('Veuillez sélectionner une image (JPG, JPEG, PNG)');
            mediaInput.value = '';
        }
    }

    function displayPreview(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Aperçu" class="img-fluid rounded shadow-sm" style="max-height: 300px;">`;
            resultsSection.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    // Soumission du formulaire
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!mediaInput.files.length) {
            alert('Veuillez sélectionner une image');
            return;
        }
        
        const formData = new FormData(uploadForm);
        const submitBtn = uploadForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Analyse en cours...';
        
        fetch(uploadForm.action, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': formData.get('csrfmiddlewaretoken')
            }
        })
        .then(response => response.json())
        .then(data => {
            console.log('Données reçues:', data);
            if (data.success) {
                displayResults(data);
            } else {
                throw new Error(data.error || 'Erreur de détection');
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            alert('Erreur: ' + error.message);
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        });
    });
    
    // NOUVELLE FONCTION D'AFFICHAGE DES RÉSULTATS
    function displayResults(data) {
        console.log('Affichage des résultats:', data);
        const resultsDiv = document.getElementById('detectionResults');
        resultsDiv.innerHTML = '';
        
        // Images
        if (data.original_image && data.processed_image) {
            resultsDiv.innerHTML += `
                <div class="row mb-4">
                    <div class="col-md-6 mb-3">
                        <h6>Image originale</h6>
                        <img src="/${data.original_image}" class="img-fluid rounded shadow">
                    </div>
                    <div class="col-md-6 mb-3">
                        <h6>Détections (${data.vehicles_detected} véhicule(s))</h6>
                        <img src="/${data.processed_image}" class="img-fluid rounded shadow">
                    </div>
                </div>
            `;
        }
        
        // PLAQUES AVEC CHAMPS ÉDITABLES
        console.log('Vérification des plaques:', data.plates, 'Longueur:', data.plates ? data.plates.length : 'undefined');
        console.log('plates_detected:', data.plates_detected);
        
        // Vérifier si des plaques ont été détectées - SEULEMENT par le tableau
        if (data.plates && data.plates.length > 0) {
            let platesHTML = `
                <div class="mt-4">
                    <h5 class="mb-3 text-center">Plaques d'immatriculation détectées (${data.plates_detected})</h5>
                    <div class="alert alert-success text-center mb-4">
                        <i class="fas fa-edit me-2"></i>
                        <strong>Tous les champs sont modifiables !</strong> 
                        Vous pouvez corriger ou modifier n'importe quel texte détecté.
                    </div>
                    <div class="row">
            `;
            
            // Vérifier si data.plates existe avant de l'utiliser
            if (data.plates && data.plates.length > 0) {
                data.plates.forEach((plate, index) => {
                    platesHTML += `
                        <div class="col-md-4 mb-4">
                            <div class="card h-100">
                                <img src="/${plate.plate_image}" class="card-img-top" style="height: 120px; object-fit: contain; background: #f8f9fa;">
                                <div class="card-body text-center">
                                    <h6 class="card-title">Plaque #${index + 1}</h6>
                                    <div class="mb-3">
                                        <label class="form-label fw-bold text-success">✏️ Texte modifiable :</label>
                                        <input type="text" 
                                               class="form-control form-control-lg text-center fw-bold plate-text-input" 
                                               data-plate-id="${plate.plate_id}" 
                                               value="${plate.plate_text}" 
                                               placeholder="Cliquez pour modifier le texte"
                                               style="font-size: 1.2em; color: #0d6efd; border: 2px solid #28a745; background-color: #f8fff9;"
                                               title="Vous pouvez toujours modifier ce texte, même s'il est correct">
                                    </div>
                                    <small class="text-muted">Confiance: ${plate.confidence} | 
                                        <span class="text-success">✓ Toujours modifiable</span>
                                    </small>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            
            platesHTML += `
                    </div>
                    <div class="text-center mt-4">
                        <button type="button" class="btn btn-success btn-lg px-5" id="savePlatesBtn">
                            <i class="fas fa-save me-2"></i>Sauvegarder les corrections
                        </button>
                    </div>
                </div>
            `;
            
            resultsDiv.innerHTML += platesHTML;
            
            // Événement de sauvegarde
            document.getElementById('savePlatesBtn').addEventListener('click', saveCorrectedPlates);
            
        }
        
        // TOUJOURS afficher le bouton de sélection manuelle (même s'il y a des plaques détectées)
        console.log('Ajout du bouton de sélection manuelle');
        resultsDiv.innerHTML += `
            <div class="alert alert-info mt-4">
                <h6><i class="fas fa-hand-pointer me-2"></i>Sélection manuelle</h6>
                <p class="mb-3">Vous pouvez également sélectionner manuellement une région de plaque dans l'image ci-dessus.</p>
                <button type="button" class="btn btn-primary" id="enableManualSelection">
                    <i class="fas fa-crop me-2"></i>Sélectionner une plaque manuellement
                </button>
            </div>
            <div id="manualSelectionArea" style="display: none;">
                <h6 class="mt-4">Cliquez et glissez sur l'image pour sélectionner la plaque :</h6>
                <div id="manualPlateResults"></div>
            </div>
        `;
        
        // Ajouter l'événement pour la sélection manuelle
        setTimeout(() => {
            const btn = document.getElementById('enableManualSelection');
            if (btn) {
                console.log('Bouton trouvé, ajout de l\'événement');
                btn.addEventListener('click', enableManualSelection);
            } else {
                console.error('Bouton enableManualSelection non trouvé');
            }
        }, 100);
        
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Sauvegarde des corrections
    function saveCorrectedPlates() {
        const inputs = document.querySelectorAll('.plate-text-input');
        const plates = Array.from(inputs).map(input => ({
            plate_id: input.dataset.plateId,
            corrected_text: input.value.trim()
        }));
        
        const saveBtn = document.getElementById('savePlatesBtn');
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sauvegarde...';
        
        fetch('/detection/save-corrected-plates/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
            },
            body: JSON.stringify({ plates })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Message de succès
                const alert = document.createElement('div');
                alert.className = 'alert alert-success alert-dismissible fade show mt-3';
                alert.innerHTML = `
                    <i class="fas fa-check-circle me-2"></i>${data.message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;
                document.getElementById('detectionResults').appendChild(alert);
                
                setTimeout(() => alert.remove(), 3000);
            } else {
                throw new Error(data.error || 'Erreur de sauvegarde');
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            alert('Erreur de sauvegarde: ' + error.message);
        })
        .finally(() => {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        });
    }
});

// Variables globales pour la sélection manuelle
let isSelecting = false;
let startX, startY, endX, endY;
let selectionBox = null;
let currentImage = null;

// Fonction pour activer la sélection manuelle
function enableManualSelection() {
    const manualArea = document.getElementById('manualSelectionArea');
    const enableBtn = document.getElementById('enableManualSelection');
    
    manualArea.style.display = 'block';
    enableBtn.disabled = true;
    enableBtn.innerHTML = '<i class="fas fa-check me-2"></i>Mode sélection activé';
    
    // Trouver l'image de résultat
    currentImage = document.querySelector('#resultsSection img');
    if (!currentImage) {
        alert('Erreur: Image non trouvée');
        return;
    }
    
    // Ajouter les événements de sélection
    currentImage.style.cursor = 'crosshair';
    currentImage.addEventListener('mousedown', startSelection);
    currentImage.addEventListener('mousemove', updateSelection);
    currentImage.addEventListener('mouseup', endSelection);
    
    // Empêcher la sélection de texte sur l'image
    currentImage.style.userSelect = 'none';
    currentImage.style.webkitUserSelect = 'none';
    currentImage.style.mozUserSelect = 'none';
    currentImage.style.msUserSelect = 'none';
    
    // Créer le conteneur de sélection
    const imageContainer = currentImage.parentElement;
    imageContainer.style.position = 'relative';
}

function startSelection(e) {
    e.preventDefault();
    isSelecting = true;
    const rect = currentImage.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    
    console.log(`Start selection at: (${startX}, ${startY})`);
    
    // Supprimer l'ancienne boîte de sélection si elle existe
    if (selectionBox) {
        selectionBox.remove();
    }
    
    // Créer la boîte de sélection
    selectionBox = document.createElement('div');
    selectionBox.style.position = 'absolute';
    selectionBox.style.border = '2px dashed #007bff';
    selectionBox.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
    selectionBox.style.pointerEvents = 'none';
    selectionBox.style.zIndex = '1000';
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    currentImage.parentElement.appendChild(selectionBox);
}

function updateSelection(e) {
    if (!isSelecting || !selectionBox) return;
    
    e.preventDefault();
    const rect = currentImage.getBoundingClientRect();
    endX = e.clientX - rect.left;
    endY = e.clientY - rect.top;
    
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    
    // Debug en temps réel
    if (width > 5 || height > 5) {
        console.log(`Selection size: ${width}x${height}`);
    }
}

function endSelection(e) {
    if (!isSelecting) return;
    
    isSelecting = false;
    const rect = currentImage.getBoundingClientRect();
    endX = e.clientX - rect.left;
    endY = e.clientY - rect.top;
    
    // Debug des coordonnées de sélection
    console.log('Coordonnées de sélection:');
    console.log(`Start: (${startX}, ${startY})`);
    console.log(`End: (${endX}, ${endY})`);
    console.log(`Image display size: ${currentImage.width}x${currentImage.height}`);
    console.log(`Image natural size: ${currentImage.naturalWidth}x${currentImage.naturalHeight}`);
    
    // Calculer les coordonnées relatives à l'image originale
    const scaleX = currentImage.naturalWidth / currentImage.width;
    const scaleY = currentImage.naturalHeight / currentImage.height;
    
    console.log(`Scale factors: X=${scaleX}, Y=${scaleY}`);
    
    const x1 = Math.min(startX, endX) * scaleX;
    const y1 = Math.min(startY, endY) * scaleY;
    const x2 = Math.max(startX, endX) * scaleX;
    const y2 = Math.max(startY, endY) * scaleY;
    
    // Calculer les dimensions en pixels de l'image originale
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    
    // Calculer aussi les dimensions sur l'image affichée
    const displayWidth = Math.abs(endX - startX);
    const displayHeight = Math.abs(endY - startY);
    
    console.log(`Sélection sur image affichée: ${displayWidth}x${displayHeight} pixels`);
    console.log(`Sélection sur image originale: ${Math.round(width)}x${Math.round(height)} pixels`);
    
    // Validation - s'assurer qu'il y a une sélection valide
    if (displayWidth < 10 || displayHeight < 10) {
        alert(`Sélection trop petite (${Math.round(displayWidth)}x${Math.round(displayHeight)} pixels). Faites glisser pour créer un rectangle de sélection d'au moins 10x10 pixels.`);
        if (selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }
        return;
    }
    
    // Extraire le texte de la région sélectionnée
    extractManualPlate(x1, y1, x2, y2);
}

function extractManualPlate(x1, y1, x2, y2) {
    const loadingDiv = document.getElementById('manualPlateResults');
    loadingDiv.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Extraction du texte en cours...</div>';
    
    // Récupérer le chemin de l'image depuis l'attribut src
    const imageSrc = currentImage.src;
    let imagePath = imageSrc.split('/').slice(-1)[0]; // Récupérer juste le nom du fichier
    
    // Si l'image path contient des paramètres de cache, les supprimer
    if (imagePath.includes('?')) {
        imagePath = imagePath.split('?')[0];
    }
    
    console.log('Image source:', imageSrc);
    console.log('Image path extracted:', imagePath);
    console.log('Coordinates:', {x1, y1, x2, y2});
    
    
    // Validation des coordonnées
    if (x1 >= x2 || y1 >= y2) {
        loadingDiv.innerHTML = '<div class="alert alert-danger">Erreur: Coordonnées invalides</div>';
        return;
    }
    
    const data = {
        image_path: imagePath,
        x1: Math.round(x1),
        y1: Math.round(y1),
        x2: Math.round(x2),
        y2: Math.round(y2)
    };
    
    console.log('Data to send:', data);
    
    fetch('/detection/extract-manual-plate/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(`HTTP ${response.status}: ${err.error || 'Erreur inconnue'}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Response data:', data);
        if (data.success) {
            displayManualPlateResult(data);
        } else {
            loadingDiv.innerHTML = `<div class="alert alert-danger">Erreur: ${data.error}</div>`;
        }
    })
    .catch(error => {
        console.error('Erreur complète:', error);
        loadingDiv.innerHTML = `<div class="alert alert-danger">Erreur: ${error.message}</div>`;
    });
    
    // Nettoyer la sélection
    if (selectionBox) {
        selectionBox.remove();
        selectionBox = null;
    }
    currentImage.style.cursor = 'default';
}

function displayManualPlateResult(data) {
    const resultsDiv = document.getElementById('manualPlateResults');
    
    // Déterminer le titre et la couleur selon la méthode de détection
    const isAutoDetected = data.detection_method === 'automatic_in_manual_region';
    const headerClass = isAutoDetected ? 'bg-primary' : 'bg-success';
    const headerText = isAutoDetected ? 
        '<i class="fas fa-magic me-2"></i>Plaque détectée automatiquement dans la région' : 
        '<i class="fas fa-hand-pointer me-2"></i>Plaque extraite manuellement';
    
    resultsDiv.innerHTML = `
        <div class="card mt-3">
            <div class="card-header ${headerClass} text-white">
                <h6 class="mb-0">${headerText}</h6>
                ${isAutoDetected ? '<small>L\'algorithme a trouvé une plaque dans votre sélection</small>' : ''}
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4">
                        <img src="/${data.plate_image}" class="img-fluid border" alt="Plaque extraite">
                        ${isAutoDetected ? '<small class="text-muted d-block mt-1">Région automatiquement détectée</small>' : ''}
                    </div>
                    <div class="col-md-8">
                        <div class="mb-3">
                            <label class="form-label fw-bold">Texte extrait :</label>
                            <input type="text" 
                                   class="form-control form-control-lg text-center fw-bold" 
                                   id="manualPlateText"
                                   value="${data.plate_text}" 
                                   placeholder="Corrigez si nécessaire"
                                   style="font-size: 1.2em; color: #0d6efd; border: 2px solid #28a745; background-color: #f8fff9;">
                        </div>
                        <div class="mb-3">
                            <small class="text-muted">
                                Confiance: ${Math.round(data.confidence * 100)}% | 
                                Méthode: ${isAutoDetected ? 'Détection automatique' : 'OCR direct'}
                            </small>
                        </div>
                        <button type="button" class="btn btn-success" onclick="saveManualPlate()">
                            <i class="fas fa-save me-2"></i>Sauvegarder cette plaque
                        </button>
                        <button type="button" class="btn btn-secondary ms-2" onclick="resetManualSelection()">
                            <i class="fas fa-redo me-2"></i>Nouvelle sélection
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function saveManualPlate() {
    const plateText = document.getElementById('manualPlateText').value;
    
    fetch('/detection/save-corrected-plates/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify({
            plates: [{
                plate_text: plateText,
                source: 'manual_selection'
            }]
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Plaque sauvegardée avec succès !');
        } else {
            alert('Erreur lors de la sauvegarde');
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        alert('Erreur lors de la sauvegarde');
    });
}

function resetManualSelection() {
    document.getElementById('manualPlateResults').innerHTML = '';
    document.getElementById('enableManualSelection').disabled = false;
    document.getElementById('enableManualSelection').innerHTML = '<i class="fas fa-crop me-2"></i>Sélectionner une plaque manuellement';
    
    // Réactiver la sélection
    if (currentImage) {
        currentImage.style.cursor = 'crosshair';
        currentImage.addEventListener('mousedown', startSelection);
        currentImage.addEventListener('mousemove', updateSelection);
        currentImage.addEventListener('mouseup', endSelection);
    }
}

// Force le rechargement du cache
console.log('Detection JS reloaded at:', new Date().toISOString());
