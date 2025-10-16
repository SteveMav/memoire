// Version 1.0 - Système de vérification des véhicules et propriétaires

// Délégation d'événements globale pour le bouton de vérification
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'verifyPlatesBtn') {
        e.preventDefault();
        e.stopPropagation();
        verifyVehicles();
    }
});

// Fonction de test pour debug
window.testManualPlateDetection = function() {
    
    const manualResults = document.getElementById('manualPlateResults');
    if (manualResults) {
        
        // Chercher les inputs dans cette zone
        const inputs = manualResults.querySelectorAll('input[type="text"]');
        inputs.forEach((input, index) => {
        });
    }
    
    // Test direct de l'élément manualPlateText
    const manualInput = document.getElementById('manualPlateText');
    if (manualInput) {
    }
    
};

// Fonction principale pour vérifier les véhicules
function verifyVehicles() {
    
    // Appeler le test de debug
    window.testManualPlateDetection();
    
    // Récupérer les plaques détectées automatiquement
    const autoInputs = document.querySelectorAll('.plate-text-input');
    
    // Récupérer les plaques détectées manuellement dans la zone manualPlateResults
    const manualResultsArea = document.getElementById('manualPlateResults');
    
    let manualInputs = [];
    if (manualResultsArea) {
        // Chercher tous les inputs dans la zone des résultats manuels
        manualInputs = manualResultsArea.querySelectorAll('input[type="text"]');
        
        manualInputs.forEach((input, index) => {
        });
    } else {
    }
    
    const plates = [];
    
    // Ajouter les plaques automatiques
    Array.from(autoInputs).forEach(input => {
        plates.push({
            plate_id: input.dataset.plateId,
            corrected_text: input.value.trim(),
            source: 'automatic'
        });
    });
    
    // Ajouter les plaques manuelles si elles existent
    Array.from(manualInputs).forEach((input, index) => {
        if (input.value.trim()) {
            plates.push({
                plate_id: input.id || ('manual_' + Date.now() + '_' + index),
                corrected_text: input.value.trim(),
                source: 'manual'
            });
        }
    });
    
    
    if (plates.length === 0) {
        if (window.showWarning) {
            window.showWarning('Aucune plaque à vérifier (ni automatique, ni manuelle)');
        } else {
            alert('Aucune plaque à vérifier (ni automatique, ni manuelle)');
        }
        return;
    }
    
    const verifyBtn = document.getElementById('verifyPlatesBtn');
    if (!verifyBtn) {
        console.error('Bouton verifyPlatesBtn non trouvé !');
        return;
    }
    
    const originalText = verifyBtn.innerHTML;
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Vérification...';
    
    // Récupération du token CSRF
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                     document.querySelector('input[name="csrfmiddlewaretoken"]')?.value ||
                     '';
    
    if (!csrfToken) {
        console.error('Token CSRF non trouvé !');
        if (window.showError) {
            window.showError('Erreur: Token CSRF manquant');
        } else {
            alert('Erreur: Token CSRF manquant');
        }
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalText;
        return;
    }
    
    console.log('Envoi de la requête de vérification...');
    fetch('/detection/save-corrected-plates/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ plates })
    })
    .then(response => {
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Ajouter l'information de source aux résultats
            if (data.matches) {
                data.matches.forEach((match, index) => {
                    if (index < plates.length) {
                        match.source = plates[index].source;
                    }
                });
            }
            displayVehicleVerificationResults(data.matches);
        } else {
            throw new Error(data.error || 'Erreur de vérification');
        }
    })
    .catch(error => {
        console.error('Erreur dans verifyVehicles:', error);
        if (window.showError) {
            window.showError('Erreur de vérification: ' + error.message);
        } else {
            alert('Erreur de vérification: ' + error.message);
        }
    })
    .finally(() => {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalText;
    });
}

// Fonction pour afficher les résultats de vérification
function displayVehicleVerificationResults(matches) {
    const verificationArea = document.getElementById('vehicleVerificationArea');
    
    if (!verificationArea) {
        console.error('Zone de vérification non trouvée !');
        return;
    }
    
    // Vider la zone de vérification
    verificationArea.innerHTML = '';
    
    const container = document.createElement('div');
    container.id = 'vehicleVerificationResults';
    container.className = 'mt-3';
    
    let html = `
        <div class="card shadow-sm border-primary">
          <div class="card-header bg-primary text-white">
            <h5 class="mb-0"><i class="fas fa-search me-2"></i>Résultats de la vérification</h5>
          </div>
          <div class="card-body">
            <div class="row">
    `;
    
    matches.forEach((match, index) => {
        html += `
          <div class="col-md-6 mb-4">
            <div class="card h-100 ${match.found ? 'border-success' : 'border-danger'}">
              <div class="card-header ${match.found ? 'bg-success' : 'bg-danger'} text-white">
                <h6 class="mb-0">
                  <i class="fas ${match.found ? 'fa-check-circle' : 'fa-times-circle'} me-2"></i>
                  Plaque: <span class="fw-bold">${(match.normalized_plate || match.query_plate || '').toUpperCase()}</span>
                  ${match.source ? `<span class="badge ${match.source === 'manual' ? 'bg-warning' : 'bg-info'} ms-2">
                    <i class="fas ${match.source === 'manual' ? 'fa-hand-pointer' : 'fa-magic'} me-1"></i>
                    ${match.source === 'manual' ? 'Manuelle' : 'Automatique'}
                  </span>` : ''}
                </h6>
              </div>
              <div class="card-body">
                ${match.found ? `
                  <div class="row">
                    <div class="col-12 mb-3">
                      <h6 class="text-success"><i class="fas fa-car me-2"></i>Informations du véhicule</h6>
                      <table class="table table-sm">
                        <tr><td><strong>Marque:</strong></td><td>${match.vehicle.brand || '—'}</td></tr>
                        <tr><td><strong>Modèle:</strong></td><td>${match.vehicle.model || '—'}</td></tr>
                        <tr><td><strong>Couleur:</strong></td><td>${match.vehicle.color || '—'}</td></tr>
                        <tr><td><strong>Année:</strong></td><td>${match.vehicle.year ?? '—'}</td></tr>
                        <tr><td><strong>Statut:</strong></td><td>
                          ${match.vehicle.is_stolen ? 
                            '<span class="badge bg-danger"><i class="fas fa-exclamation-triangle me-1"></i>DÉCLARÉ VOLÉ</span>' : 
                            '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Normal</span>'
                          }
                        </td></tr>
                      </table>
                    </div>
                    <div class="col-12">
                      <h6 class="text-primary"><i class="fas fa-user me-2"></i>Propriétaire</h6>
                      <table class="table table-sm">
                        <tr><td><strong>Nom:</strong></td><td>${[match.owner.first_name, match.owner.last_name].filter(Boolean).join(' ') || '—'}</td></tr>
                        <tr><td><strong>Username:</strong></td><td>${match.owner.username || '—'}</td></tr>
                        <tr><td><strong>Email:</strong></td><td>${match.owner.email || '—'}</td></tr>
                      </table>
                      <div class="d-flex justify-content-end mt-3">
                        <button class="btn btn-danger btn-sm btn-amende" onclick="showAmendeModal({
                          id: ${match.vehicle.id},
                          plate_number: '${match.vehicle.plate}',
                          brand: '${match.vehicle.brand}',
                          model: '${match.vehicle.model}',
                          year: ${match.vehicle.year || 'null'},
                          owner: {
                            first_name: '${match.owner.first_name}',
                            last_name: '${match.owner.last_name}',
                            email: '${match.owner.email}'
                          }
                        })">
                          <i class="fas fa-gavel me-1"></i>Émettre Amende
                        </button>
                      </div>
                    </div>
                  </div>
                ` : `
                  <div class="text-center text-muted">
                    <i class="fas fa-search fa-3x mb-3"></i>
                    <p class="mb-0">${match.message || 'Aucun véhicule correspondant trouvé dans la base de données.'}</p>
                  </div>
                `}
              </div>
            </div>
          </div>
        `;
    });
    
    html += `
            </div>
            <div class="text-center mt-3">
              <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                Vérification terminée. ${matches.filter(m => m.found).length} véhicule(s) trouvé(s) sur ${matches.length} plaque(s) vérifiée(s).
              </div>
            </div>
          </div>
        </div>
    `;
    
    container.innerHTML = html;
    verificationArea.appendChild(container);
    container.scrollIntoView({ behavior: 'smooth' });
}

// Fonction de test pour le bouton vérifier
window.testVerifyButton = function() {
    const verifyBtn = document.getElementById('verifyPlatesBtn');
    if (verifyBtn) {
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        verifyBtn.dispatchEvent(clickEvent);
    } else {
    }
};

// Fonction de test pour sauvegarde directe avec vérification
window.testDirectVerify = function() {
    
    // Récupération du token CSRF
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                     document.querySelector('input[name="csrfmiddlewaretoken"]')?.value ||
                     '';
    
    if (!csrfToken) {
        if (window.showError) {
            window.showError('Token CSRF non trouvé !');
        } else {
            alert('Token CSRF non trouvé !');
        }
        return;
    }
    
    // Test avec des données factices
    const testData = {
        plates: [{
            plate_id: 'test_1',
            corrected_text: 'TEST123'
        }]
    };
    
    
    fetch('/detection/save-corrected-plates/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify(testData)
    })
    .then(response => {
        return response.json();
    })
    .then(data => {
        if (data.matches) {
            displayVehicleVerificationResults(data.matches);
        }
        if (window.showSuccess) {
            window.showSuccess('Test vérification réussi ! Voir la console pour les détails.');
        } else {
            alert('Test vérification réussi ! Voir la console pour les détails.');
        }
    })
    .catch(error => {
        console.error('Erreur test vérification:', error);
        if (window.showError) {
            window.showError('Erreur test vérification: ' + error.message);
        } else {
            alert('Erreur test vérification: ' + error.message);
        }
        console.log('Verification JS reloaded at:', new Date().toISOString());
        console.log('Version: Support détection manuelle v2.0');
    });
};

// ===== SYSTÈME D'ÉMISSION D'AMENDES =====

// Variables globales pour l'émission d'amendes
let currentVehicleForAmende = null;
let infractions = [];

// Fonction utilitaire pour récupérer le token CSRF
function getCsrfToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
           document.querySelector('input[name="csrfmiddlewaretoken"]')?.value ||
           '';
}

// Fonction pour charger les infractions disponibles
async function loadInfractions() {
    try {
        const response = await fetch('/detection/get-infractions/', {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCsrfToken()
            }
        });


        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erreur HTTP:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('📦 Données reçues:', data);
        
        if (data.success) {
            infractions = data.infractions;
            console.log('✅ Infractions chargées:', infractions.length);
            if (infractions.length > 0) {
                console.log('📋 Première infraction:', infractions[0]);
            }
            return true;
        } else {
            throw new Error(data.error || 'Erreur lors du chargement des infractions');
        }
    } catch (error) {
        console.error('Erreur chargement infractions:', error);
        if (window.showError) {
            window.showError('Erreur lors du chargement des infractions: ' + error.message);
        } else {
            alert('Erreur lors du chargement des infractions: ' + error.message);
        }
        return false;
    }
}

// Fonction pour afficher le modal d'émission d'amende
function showAmendeModal(vehicle) {
    currentVehicleForAmende = vehicle;
    
    // Créer le modal s'il n'existe pas
    let modal = document.getElementById('amendeModal');
    if (!modal) {
        createAmendeModal();
        modal = document.getElementById('amendeModal');
    }
    
    // Remplir les informations du véhicule
    document.getElementById('amendeVehiclePlate').textContent = vehicle.plate_number;
    document.getElementById('amendeVehicleInfo').textContent = 
        `${vehicle.brand} ${vehicle.model} (${vehicle.year || 'N/A'})`;
    document.getElementById('amendeOwnerInfo').textContent = 
        `${vehicle.owner.first_name} ${vehicle.owner.last_name} - ${vehicle.owner.email}`;
    
    // Charger les infractions dans le select
    populateInfractionsSelect();
    
    // Afficher le modal
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
}

// Fonction pour créer le modal d'émission d'amende
function createAmendeModal() {
    const modalHtml = `
    <div class="modal fade" id="amendeModal" tabindex="-1" aria-labelledby="amendeModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title" id="amendeModalLabel">
                        <i class="fas fa-gavel me-2"></i>Émission d'Amende
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <!-- Informations du véhicule -->
                    <div class="card mb-3">
                        <div class="card-header bg-primary text-white">
                            <h6 class="mb-0"><i class="fas fa-car me-2"></i>Véhicule concerné</h6>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-4">
                                    <strong>Plaque:</strong><br>
                                    <span id="amendeVehiclePlate" class="badge bg-dark fs-6"></span>
                                </div>
                                <div class="col-md-4">
                                    <strong>Véhicule:</strong><br>
                                    <span id="amendeVehicleInfo"></span>
                                </div>
                                <div class="col-md-4">
                                    <strong>Propriétaire:</strong><br>
                                    <span id="amendeOwnerInfo"></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Formulaire d'amende -->
                    <form id="amendeForm">

                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label for="infractionSelect" class="form-label">
                                        <i class="fas fa-exclamation-triangle text-warning me-1"></i>
                                        Infraction commise *
                                    </label>
                                    <select class="form-select" id="infractionSelect" required>
                                        <option value="">Sélectionner une infraction...</option>
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label for="amendeAmount" class="form-label">
                                        <i class="fas fa-money-bill text-success me-1"></i>
                                        Montant de l'amende 
                                    </label>
                                    <input type="number" class="form-control" id="amendeAmount" readonly>
                                </div>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label for="lieuInfraction" class="form-label">
                                <i class="fas fa-map-marker-alt text-info me-1"></i>
                                Lieu de l'infraction *
                            </label>
                            <input type="text" class="form-control" id="lieuInfraction" 
                                   placeholder="Ex: Avenue Kasa-Vubu, Kinshasa" required>
                        </div>

                        <div class="mb-3">
                            <label for="observations" class="form-label">
                                <i class="fas fa-sticky-note text-secondary me-1"></i>
                                Observations (optionnel)
                            </label>
                            <textarea class="form-control" id="observations" rows="3" 
                                      placeholder="Détails supplémentaires sur l'infraction..."></textarea>
                        </div>

                        <!-- Détails de l'infraction sélectionnée -->
                        <div id="infractionDetails" class="card bg-light" style="display: none;">
                            <div class="card-body">
                                <h6 class="card-title">Détails de l'infraction</h6>
                                <div id="infractionDescription"></div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-1"></i>Annuler
                    </button>
                    <button type="button" class="btn btn-danger" id="emettrAmendeBtn">
                        <i class="fas fa-gavel me-1"></i>Émettre l'Amende
                    </button>
                </div>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Ajouter les event listeners
    document.getElementById('infractionSelect').addEventListener('change', onInfractionChange);
    document.getElementById('emettrAmendeBtn').addEventListener('click', emettrAmende);
}

// Fonction pour remplir le select des infractions
function populateInfractionsSelect() {
    const select = document.getElementById('infractionSelect');
    select.innerHTML = '<option value="">Sélectionner une infraction...</option>';
    
    // Grouper par catégorie
    const categories = {};
    infractions.forEach(infraction => {
        if (!categories[infraction.category]) {
            categories[infraction.category] = [];
        }
        categories[infraction.category].push(infraction);
    });
    
    // Ajouter les options groupées
    Object.keys(categories).forEach(category => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = getCategoryDisplayName(category);
        
        categories[category].forEach(infraction => {
            const option = document.createElement('option');
            option.value = infraction.id;
            option.textContent = `${infraction.code_article} - ${infraction.description.substring(0, 80)}...`;
            option.dataset.amende = infraction.amende_moyenne;
            option.dataset.description = infraction.description;
            option.dataset.category = infraction.category;
            optgroup.appendChild(option);
        });
        
        select.appendChild(optgroup);
    });
}

// Fonction pour obtenir le nom d'affichage de la catégorie
function getCategoryDisplayName(category) {
    const categories = {
        'CONDUITE': 'Conduite des véhicules et des animaux',
        'USAGE_VOIE': 'Usage des voies ouvertes à la circulation',
        'VEHICULE': 'Equipement des véhicules',
        'ADMINISTRATIF': 'Conditions administratives et documents',
        'PERMIS': 'Permis de conduire',
        'GENERAL': 'Dispositions générales'
    };
    return categories[category] || category;
}

// Fonction appelée lors du changement d'infraction
function onInfractionChange() {
    const select = document.getElementById('infractionSelect');
    const selectedOption = select.options[select.selectedIndex];
    const amendeAmount = document.getElementById('amendeAmount');
    const infractionDetails = document.getElementById('infractionDetails');
    const infractionDescription = document.getElementById('infractionDescription');
    
    if (selectedOption.value) {
        // Afficher le montant
        amendeAmount.value = selectedOption.dataset.amende;
        
        // Afficher les détails
        infractionDescription.innerHTML = `
            <p><strong>Code:</strong> ${selectedOption.textContent.split(' - ')[0]}</p>
            <p><strong>Catégorie:</strong> ${getCategoryDisplayName(selectedOption.dataset.category)}</p>
            <p><strong>Description:</strong> ${selectedOption.dataset.description}</p>
            <p><strong>Montant:</strong> ${selectedOption.dataset.amende} Fc</p>
        `;
        infractionDetails.style.display = 'block';
    } else {
        amendeAmount.value = '';
        infractionDetails.style.display = 'none';
    }
}

// Fonction pour émettre l'amende
async function emettrAmende() {
    const form = document.getElementById('amendeForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const infractionId = document.getElementById('infractionSelect').value;
    const lieuInfraction = document.getElementById('lieuInfraction').value;
    const observations = document.getElementById('observations').value;
    
    if (!infractionId) {
        if (window.showError) {
            window.showError('Veuillez sélectionner une infraction');
        } else {
            alert('Veuillez sélectionner une infraction');
        }
        return;
    }
    
    // Désactiver le bouton pendant le traitement
    const btn = document.getElementById('emettrAmendeBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Émission en cours...';
    
    try {
        const requestData = {
            vehicle_id: currentVehicleForAmende.id,
            infraction_id: infractionId,
            lieu_infraction: lieuInfraction,
            observations: observations,
            detection_id: currentVehicleForAmende.detection_id || null
        };
        
        
        const response = await fetch('/detection/emettre-amende/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            // Fermer le modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('amendeModal'));
            modal.hide();
            
            // Afficher le succès
            const message = `Amende ${data.amende.numero} émise avec succès!\n` +
                          `Montant: ${data.amende.montant} Fc\n` +
                          `Date limite: ${data.amende.date_limite}\n` +
                          `Email envoyé: ${data.amende.email_envoye ? 'Oui' : 'Non'}`;
            
            if (window.showSuccess) {
                window.showSuccess(message);
            } else {
                alert(message);
            }
            
            console.log('Amende émise:', data.amende);
        } else {
            throw new Error(data.error || 'Erreur lors de l\'émission de l\'amende');
        }
        
    } catch (error) {
        console.error('Erreur émission amende:', error);
        if (window.showError) {
            window.showError('Erreur lors de l\'émission de l\'amende: ' + error.message);
        } else {
            alert('Erreur lors de l\'émission de l\'amende: ' + error.message);
        }
    } finally {
        // Réactiver le bouton
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Fonction pour ajouter le bouton d'amende aux résultats de vérification
function addAmendeButtonToResult(vehicleElement, vehicle) {
    // Vérifier si le bouton existe déjà
    if (vehicleElement.querySelector('.btn-amende')) {
        return;
    }
    
    // Créer le bouton d'amende
    const amendeBtn = document.createElement('button');
    amendeBtn.className = 'btn btn-danger btn-sm btn-amende ms-2';
    amendeBtn.innerHTML = '<i class="fas fa-gavel me-1"></i>Émettre Amende';
    amendeBtn.onclick = () => showAmendeModal(vehicle);
    
    // Ajouter le bouton après les autres boutons
    const buttonContainer = vehicleElement.querySelector('.d-flex') || vehicleElement;
    buttonContainer.appendChild(amendeBtn);
}



// Initialiser le système d'amendes au chargement de la page
// Force le rechargement du cache - Version avec support détection manuelle + amendes
