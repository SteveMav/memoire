// Version 3.0 - Système de détection et extraction de plaques (séparé de la vérification)
document.addEventListener('DOMContentLoaded', function() {
    console.log('Detection JS v3.0 loaded (séparé de la vérification)');
    
    // Test de fonctionnement des événements
    console.log('DOM chargé, vérification des éléments...');
    
    // Délégation d'événements globale pour le bouton sauvegarde
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'savePlatesBtn') {
            console.log('Clic sur savePlatesBtn capturé par délégation globale');
            e.preventDefault();
            e.stopPropagation();
            savePlatesOnly();
        }
    });
    
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
            if (window.showError) {
                window.showError('Veuillez sélectionner une image (JPG, JPEG, PNG)');
            } else {
                alert('Veuillez sélectionner une image (JPG, JPEG, PNG)');
            }
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
            if (window.showError) {
                window.showError('Veuillez sélectionner une image');
            } else {
                alert('Veuillez sélectionner une image');
            }
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
            if (window.showError) {
                window.showError('Erreur: ' + error.message);
            } else {
                alert('Erreur: ' + error.message);
            }
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        });
    });
    
    // NOUVELLE FONCTION D'AFFICHAGE DES RÉSULTATS
    function displayResults(data) {
        console.log('Affichage des résultats:', data);
        
        // Stocker les données pour la sauvegarde ultérieure
        window.lastDetectionData = data;
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
                        <button type="button" class="btn btn-success btn-lg px-4" id="savePlatesBtn">
                            <i class="fas fa-save me-2"></i>Sauvegarder les corrections
                        </button>
                    </div>
                </div>
            `;
            
            resultsDiv.innerHTML += platesHTML;
            
            // Attachement de l'événement pour le bouton sauvegarder
            setTimeout(() => {
                const saveBtn = document.getElementById('savePlatesBtn');
                if (saveBtn) {
                    console.log('Bouton savePlatesBtn trouvé');
                    saveBtn.addEventListener('click', function(e) {
                        console.log('Clic sur savePlatesBtn détecté');
                        e.preventDefault();
                        e.stopPropagation();
                        savePlatesOnly();
                    });
                    console.log('Événement attaché au bouton savePlatesBtn');
                }
            }, 200);
            
        }
        
        // Ajouter le bouton de détection manuelle (toujours visible)
        resultsDiv.innerHTML += `
            <div class="mt-4">
                <div class="text-center">
                    <button type="button" class="btn btn-primary btn-lg px-4" id="enableManualSelection">
                        <i class="fas fa-crop me-2"></i>Sélectionner une plaque manuellement
                    </button>
                    <p class="text-muted mt-2 mb-0">
                        <small>Utilisez cette option si une plaque n'a pas été détectée automatiquement</small>
                    </p>
                </div>
            </div>
        `;
        
        // Attachement de l'événement pour le bouton de détection manuelle
        setTimeout(() => {
            const manualBtn = document.getElementById('enableManualSelection');
            if (manualBtn) {
                console.log('Bouton enableManualSelection trouvé');
                manualBtn.addEventListener('click', function(e) {
                    console.log('Clic sur enableManualSelection détecté');
                    e.preventDefault();
                    e.stopPropagation();
                    enableManualSelection();
                });
                console.log('Événement attaché au bouton enableManualSelection');
            }
        }, 200);
        
        // Afficher la section de vérification permanente
        showPermanentVerificationSection();
        
        resultsSection.style.display = 'block';
        
        // Afficher la section de débogage
        const debugSection = document.getElementById('debugSection');
        if (debugSection) {
            debugSection.style.display = 'block';
        }
        
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Sauvegarde des corrections
    function saveCorrectedPlates() {
        console.log('Fonction saveCorrectedPlates appelée');
        
        const inputs = document.querySelectorAll('.plate-text-input');
        console.log('Inputs trouvés:', inputs.length);
        
        const plates = Array.from(inputs).map(input => ({
            plate_id: input.dataset.plateId,
            corrected_text: input.value.trim()
        }));
        console.log('Plaques à sauvegarder:', plates);
        
        const saveBtn = document.getElementById('savePlatesBtn');
        if (!saveBtn) {
            console.error('Bouton savePlatesBtn non trouvé dans saveCorrectedPlates !');
            return;
        }
        
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sauvegarde...';
        
        // Récupération du token CSRF avec vérification
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                         document.querySelector('input[name="csrfmiddlewaretoken"]')?.value ||
                         '';
        
        console.log('Token CSRF trouvé:', csrfToken ? 'Oui' : 'Non');
        
        if (!csrfToken) {
            console.error('Token CSRF non trouvé !');
            if (window.showError) {
                window.showError('Erreur: Token CSRF manquant');
            } else {
                alert('Erreur: Token CSRF manquant');
            }
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
            return;
        }
        
        console.log('Envoi de la requête fetch...');
        fetch('/detection/save-corrected-plates/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ plates })
        })
        .then(response => {
            console.log('Réponse reçue:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Données reçues:', data);
            if (data.success) {
                const resultsRoot = document.getElementById('detectionResults');
                // Message de succès
                const alert = document.createElement('div');
                alert.className = 'alert alert-success alert-dismissible fade show mt-3';
                alert.innerHTML = `
                    <i class="fas fa-check-circle me-2"></i>${data.message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;
                resultsRoot.appendChild(alert);

                // Affichage des correspondances véhicule/propriétaire
                if (Array.isArray(data.matches) && data.matches.length > 0) {
                    const container = document.createElement('div');
                    container.className = 'mt-3';

                    let html = `
                        <div class="card shadow-sm">
                          <div class="card-header bg-dark text-white">
                            <i class="fas fa-car me-2"></i>Résultats de la recherche véhicule / propriétaire
                          </div>
                          <div class="card-body">
                            <div class="row">
                    `;

                    data.matches.forEach((m, idx) => {
                        html += `
                          <div class="col-md-6 mb-3">
                            <div class="border rounded p-3 h-100 ${m.found ? 'border-success' : 'border-danger'}">
                              <h6 class="mb-2">
                                <span class="badge ${m.found ? 'bg-success' : 'bg-danger'} me-2">${m.found ? 'TROUVÉ' : 'NON TROUVÉ'}</span>
                                Plaque: <span class="fw-bold">${(m.normalized_plate || m.query_plate || '').toUpperCase()}</span>
                              </h6>
                              ${m.found ? `
                                <div class="mb-2">
                                  <div class="small text-muted">Véhicule</div>
                                  <div class="fw-semibold">${m.vehicle.brand || ''} ${m.vehicle.model || ''}</div>
                                  <div>Couleur: ${m.vehicle.color || '—'}</div>
                                  <div>Année: ${m.vehicle.year ?? '—'}</div>
                                  <div>
                                    Statut: ${m.vehicle.is_stolen ? '<span class="badge bg-danger">Déclaré volé</span>' : '<span class="badge bg-success">Normal</span>'}
                                  </div>
                                </div>
                                <div>
                                  <div class="small text-muted">Propriétaire</div>
                                  <div class="fw-semibold">${[m.owner.first_name, m.owner.last_name].filter(Boolean).join(' ') || m.owner.username}</div>
                                  <div class="text-muted">${m.owner.email || ''}</div>
                                </div>
                              ` : `
                                <div class="text-muted">${m.message || 'Aucun véhicule correspondant trouvé.'}</div>
                              `}
                            </div>
                          </div>
                        `;
                    });

                    html += `
                            </div>
                          </div>
                        </div>
                    `;

                    container.innerHTML = html;
                    resultsRoot.appendChild(container);
                    container.scrollIntoView({ behavior: 'smooth' });
                }

                // Retirer automatiquement l'alerte après 3s
                setTimeout(() => alert.remove(), 3000);
            } else {
                throw new Error(data.error || 'Erreur de sauvegarde');
            }
        })
        .catch(error => {
            console.error('Erreur dans saveCorrectedPlates:', error);
            if (window.showError) {
                window.showError('Erreur de sauvegarde: ' + error.message);
            } else {
                alert('Erreur de sauvegarde: ' + error.message);
            }
        })
        .finally(() => {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        });
    }
    
    // Fonction pour sauvegarder les plaques corrigées
    function savePlatesOnly() {
        console.log('Fonction savePlatesOnly appelée');
        
        const inputs = document.querySelectorAll('.plate-text-input');
        console.log('Inputs trouvés:', inputs.length);
        
        if (inputs.length === 0) {
            if (window.showWarning) {
                window.showWarning('Aucune plaque à sauvegarder');
            } else {
                alert('Aucune plaque à sauvegarder');
            }
            return;
        }
        
        const plates = Array.from(inputs).map(input => ({
            plate_id: input.dataset.plateId,
            corrected_text: input.value.trim()
        }));
        console.log('Plaques à sauvegarder:', plates);
        
        const saveBtn = document.getElementById('savePlatesBtn');
        if (!saveBtn) {
            console.error('Bouton savePlatesBtn non trouvé !');
            return;
        }
        
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sauvegarde...';
        
        // Récupération du token CSRF
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                         document.querySelector('input[name="csrfmiddlewaretoken"]')?.value ||
                         '';
        
        console.log('Token CSRF trouvé:', csrfToken ? 'Oui' : 'Non');
        
        if (!csrfToken) {
            console.error('Token CSRF non trouvé !');
            if (window.showError) {
                window.showError('Erreur: Token CSRF manquant');
            } else {
                alert('Erreur: Token CSRF manquant');
            }
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
            return;
        }
        
        // Récupérer l'image originale depuis les données de la dernière détection
        let originalImage = null;
        if (window.lastDetectionData && window.lastDetectionData.original_image) {
            originalImage = window.lastDetectionData.original_image;
        }
        
        console.log('Image originale:', originalImage);
        
        // Préparer les données à envoyer
        const dataToSend = {
            plates: plates,
            original_image: originalImage
        };
        
        console.log('Données à envoyer:', dataToSend);
        
        // Envoi de la requête
        fetch('/detection/save-corrected-plates/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(dataToSend)
        })
        .then(response => {
            console.log('Réponse reçue:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Données reçues:', data);
            
            if (data.success) {
                // Afficher un message de succès
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-success alert-dismissible fade show mt-3';
                alertDiv.innerHTML = `
                    <i class="fas fa-check-circle me-2"></i>
                    ${data.message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;
                
                // Insérer l'alerte avant le bouton
                saveBtn.parentNode.insertBefore(alertDiv, saveBtn);
                
                // Afficher les résultats de correspondance
                if (data.matches && data.matches.length > 0) {
                    let matchesHTML = '<div class="mt-3"><h6>Résultats de la recherche :</h6>';
                    
                    data.matches.forEach(match => {
                        if (match.found) {
                            matchesHTML += `
                                <div class="alert alert-info">
                                    <strong>Plaque ${match.normalized_plate}</strong> - 
                                    <span class="text-success">Véhicule trouvé !</span><br>
                                    ${match.vehicle.brand} ${match.vehicle.model} (${match.vehicle.color})
                                    ${match.vehicle.is_stolen ? '<span class="badge bg-danger ms-2">VOLÉ</span>' : ''}
                                </div>
                            `;
                        } else {
                            matchesHTML += `
                                <div class="alert alert-warning">
                                    <strong>Plaque ${match.normalized_plate}</strong> - 
                                    <span class="text-warning">Aucun véhicule trouvé</span>
                                </div>
                            `;
                        }
                    });
                    
                    matchesHTML += '</div>';
                    alertDiv.insertAdjacentHTML('afterend', matchesHTML);
                }
                
                // Auto-fermeture de l'alerte après 5 secondes
                setTimeout(() => {
                    if (alertDiv && alertDiv.parentNode) {
                        alertDiv.remove();
                    }
                }, 5000);
                
            } else {
                if (window.showError) {
                    window.showError('Erreur lors de la sauvegarde: ' + (data.error || 'Erreur inconnue'));
                } else {
                    alert('Erreur lors de la sauvegarde: ' + (data.error || 'Erreur inconnue'));
                }
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            if (window.showError) {
                window.showError('Erreur lors de la sauvegarde: ' + error.message);
            } else {
                alert('Erreur lors de la sauvegarde: ' + error.message);
            }
        })
        .finally(() => {
            // Restaurer le bouton
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        });
    }
    
    // Fonction pour afficher la section de vérification permanente
    function showPermanentVerificationSection() {
        console.log('Affichage de la section de vérification permanente');
        
        const permanentSection = document.getElementById('permanentVerificationSection');
        if (permanentSection) {
            permanentSection.style.display = 'block';
            console.log('✅ Section de vérification permanente affichée');
        } else {
            console.error('❌ Section de vérification permanente non trouvée');
        }
    }
});

// Variables globales pour la sélection manuelle
let isSelecting = false;
let startX, startY, endX, endY;
let selectionBox = null;
let currentImage = null;

// Fonction pour activer la sélection manuelle
function enableManualSelection() {
    console.log('Activation de la sélection manuelle');
    
    // Trouver l'image des résultats
    const resultImages = document.querySelectorAll('#detectionResults img');
    if (resultImages.length === 0) {
        if (window.showError) {
            window.showError('Aucune image trouvée pour la sélection manuelle');
        } else {
            alert('Aucune image trouvée pour la sélection manuelle');
        }
        return;
    }
    
    // Utiliser la première image (image originale)
    currentImage = resultImages[0];
    
    // Afficher la section de sélection manuelle
    const manualArea = document.getElementById('manualSelectionArea');
    if (manualArea) {
        manualArea.style.display = 'block';
    }
    
    // Changer le curseur et ajouter les événements
    currentImage.style.cursor = 'crosshair';
    currentImage.addEventListener('mousedown', startSelection);
    currentImage.addEventListener('mousemove', updateSelection);
    currentImage.addEventListener('mouseup', endSelection);
    
    // Désactiver le bouton
    const manualBtn = document.getElementById('enableManualSelection');
    if (manualBtn) {
        manualBtn.disabled = true;
        manualBtn.innerHTML = '<i class="fas fa-crop me-2"></i>Sélection activée - Cliquez et glissez sur l\'image';
    }
    
    if (window.showInfo) {
        window.showInfo('Sélection manuelle activée ! Cliquez et glissez sur l\'image pour sélectionner une plaque.');
    } else {
        alert('Sélection manuelle activée ! Cliquez et glissez sur l\'image pour sélectionner une plaque.');
    }
}

function startSelection(e) {
    if (!currentImage) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    isSelecting = true;
    
    // S'assurer que le conteneur parent a position relative
    const parent = currentImage.parentElement;
    if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
    }
    
    const rect = currentImage.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    
    // Calculer les coordonnées relatives au conteneur parent
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    
    console.log('Start selection:', { startX, startY });
    
    // Créer la boîte de sélection
    selectionBox = document.createElement('div');
    selectionBox.style.position = 'absolute';
    selectionBox.style.border = '2px dashed #007bff';
    selectionBox.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
    selectionBox.style.pointerEvents = 'none';
    selectionBox.style.zIndex = '1000';
    
    // Positionner relativement à l'image
    const imageRect = currentImage.getBoundingClientRect();
    const containerRect = parent.getBoundingClientRect();
    
    const offsetX = imageRect.left - containerRect.left;
    const offsetY = imageRect.top - containerRect.top;
    
    selectionBox.style.left = (offsetX + startX) + 'px';
    selectionBox.style.top = (offsetY + startY) + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    
    parent.appendChild(selectionBox);
}

function updateSelection(e) {
    if (!isSelecting || !selectionBox) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = currentImage.getBoundingClientRect();
    endX = e.clientX - rect.left;
    endY = e.clientY - rect.top;
    
    // Calculer les dimensions de la sélection
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    
    // Calculer l'offset de l'image par rapport à son conteneur
    const parent = currentImage.parentElement;
    const imageRect = currentImage.getBoundingClientRect();
    const containerRect = parent.getBoundingClientRect();
    
    const offsetX = imageRect.left - containerRect.left;
    const offsetY = imageRect.top - containerRect.top;
    
    // Positionner la boîte de sélection
    selectionBox.style.left = (offsetX + left) + 'px';
    selectionBox.style.top = (offsetY + top) + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    
    // Debug en temps réel
    if (width > 5 || height > 5) {
        console.log(`Selection size: ${width}x${height}`);
    }
}

function endSelection(e) {
    if (!isSelecting) return;
    
    e.preventDefault();
    e.stopPropagation();
    
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
    
    // Calculer les dimensions sur l'image affichée
    const displayWidth = Math.abs(endX - startX);
    const displayHeight = Math.abs(endY - startY);
    
    console.log(`Sélection sur image affichée: ${displayWidth}x${displayHeight} pixels`);
    
    // Validation - s'assurer qu'il y a une sélection valide
    if (displayWidth < 10 || displayHeight < 10) {
        if (window.showWarning) {
            window.showWarning(`Sélection trop petite (${Math.round(displayWidth)}x${Math.round(displayHeight)} pixels). Faites glisser pour créer un rectangle de sélection d'au moins 10x10 pixels.`);
        } else {
            alert(`Sélection trop petite (${Math.round(displayWidth)}x${Math.round(displayHeight)} pixels). Faites glisser pour créer un rectangle de sélection d'au moins 10x10 pixels.`);
        }
        if (selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }
        return;
    }
    
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
    
    console.log(`Sélection sur image originale: ${Math.round(width)}x${Math.round(height)} pixels`);
    console.log(`Coordonnées finales: x1=${Math.round(x1)}, y1=${Math.round(y1)}, x2=${Math.round(x2)}, y2=${Math.round(y2)}`);
    
    // Extraire le texte de la région sélectionnée
    extractManualPlate(x1, y1, x2, y2);
}

function extractManualPlate(x1, y1, x2, y2) {
    const loadingDiv = document.getElementById('manualPlateResults');
    if (loadingDiv) {
        loadingDiv.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Extraction du texte en cours...</div>';
    }
    
    // Récupérer le chemin de l'image depuis les données de la dernière détection
    let imagePath = null;
    if (window.lastDetectionData && window.lastDetectionData.original_image) {
        imagePath = window.lastDetectionData.original_image;
    }
    
    if (!imagePath) {
        if (window.showError) {
            window.showError('Impossible de trouver le chemin de l\'image');
        } else {
            alert('Impossible de trouver le chemin de l\'image');
        }
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
            if (loadingDiv) {
                loadingDiv.innerHTML = `<div class="alert alert-danger">Erreur: ${data.error}</div>`;
            }
        }
    })
    .catch(error => {
        console.error('Erreur complète:', error);
        if (loadingDiv) {
            loadingDiv.innerHTML = `<div class="alert alert-danger">Erreur: ${error.message}</div>`;
        }
    });
    
    // Nettoyer la sélection
    if (selectionBox) {
        selectionBox.remove();
        selectionBox = null;
    }
    currentImage.style.cursor = 'default';
    
    // Réactiver le bouton de sélection manuelle
    const manualBtn = document.getElementById('enableManualSelection');
    if (manualBtn) {
        manualBtn.disabled = false;
        manualBtn.innerHTML = '<i class="fas fa-crop me-2"></i>Sélectionner une plaque manuellement';
    }
}

function displayManualPlateResult(data) {
    const resultsDiv = document.getElementById('manualPlateResults');
    if (!resultsDiv) return;
    
    resultsDiv.innerHTML = `
        <div class="card mt-3">
            <div class="card-header bg-success text-white">
                <h6 class="mb-0"><i class="fas fa-hand-pointer me-2"></i>Plaque extraite manuellement</h6>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4">
                        <img src="/${data.plate_image}" class="img-fluid border" alt="Plaque extraite">
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
                            <small class="text-muted">Confiance: ${Math.round(data.confidence * 100)}%</small>
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
    console.log('Sauvegarde plaque manuelle:', plateText);
    
    // Utiliser la même fonction de sauvegarde que pour les plaques automatiques
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    
    if (!csrfToken) {
        if (window.showError) {
            window.showError('Erreur: Token CSRF manquant');
        } else {
            alert('Erreur: Token CSRF manquant');
        }
        return;
    }
    
    fetch('/detection/save-corrected-plates/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            plates: [{
                plate_id: 'manual_' + Date.now(),
                corrected_text: plateText
            }]
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Réponse saveManualPlate:', data);
        if (data.success) {
            if (window.showSuccess) {
                window.showSuccess(data.message);
            } else {
                alert('Plaque sauvegardée avec succès !');
            }
            
            // Afficher les résultats de correspondance si disponibles
            if (data.matches && data.matches.length > 0) {
                const match = data.matches[0];
                if (match.found) {
                    if (window.showInfo) {
                        window.showInfo(`Véhicule trouvé ! ${match.vehicle.brand} ${match.vehicle.model} - Propriétaire: ${[match.owner.first_name, match.owner.last_name].filter(Boolean).join(' ') || match.owner.username}`);
                    }
                } else {
                    if (window.showWarning) {
                        window.showWarning(`Aucun véhicule trouvé pour la plaque ${plateText}`);
                    }
                }
            }
        } else {
            if (window.showError) {
                window.showError('Erreur: ' + (data.error || 'Erreur inconnue'));
            } else {
                alert('Erreur: ' + (data.error || 'Erreur inconnue'));
            }
        }
    })
    .catch(error => {
        console.error('Erreur saveManualPlate:', error);
        if (window.showError) {
            window.showError('Erreur: ' + error.message);
        } else {
            alert('Erreur: ' + error.message);
        }
    });
}

function resetManualSelection() {
    const manualResults = document.getElementById('manualPlateResults');
    if (manualResults) {
        manualResults.innerHTML = '';
    }
    
    const manualBtn = document.getElementById('enableManualSelection');
    if (manualBtn) {
        manualBtn.disabled = false;
        manualBtn.innerHTML = '<i class="fas fa-crop me-2"></i>Sélectionner une plaque manuellement';
    }
    
    // Nettoyer toute sélection en cours
    if (selectionBox) {
        selectionBox.remove();
        selectionBox = null;
    }
    
    // Réinitialiser les variables
    isSelecting = false;
    
    // Réinitialiser le curseur
    if (currentImage) {
        currentImage.style.cursor = 'default';
        // Supprimer les anciens événements pour éviter les doublons
        currentImage.removeEventListener('mousedown', startSelection);
        currentImage.removeEventListener('mousemove', updateSelection);
        currentImage.removeEventListener('mouseup', endSelection);
    }
    
    if (window.showInfo) {
        window.showInfo('Sélection manuelle réinitialisée. Cliquez sur le bouton pour recommencer.');
    }
}

// Force le rechargement du cache
console.log('Detection JS reloaded at:', new Date().toISOString());
