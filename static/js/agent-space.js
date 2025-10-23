/**
 * JavaScript pour l'espace agent - Gestion des recherches asynchrones et codes agents
 */

document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const plateSearchInput = document.getElementById('plateSearch');
    const searchLoader = document.getElementById('searchLoader');
    const searchResults = document.getElementById('searchResults');
    const searchResultsContent = document.getElementById('searchResultsContent');
    
    // Éléments pour la recherche d'amendes
    const amendeSearchForm = document.getElementById('amendeSearchForm');
    const amendeSearchInput = document.getElementById('amendeSearch');
    const amendeSearchLoader = document.getElementById('amendeSearchLoader');
    const amendeSearchResults = document.getElementById('amendeSearchResults');
    const amendeSearchResultsContent = document.getElementById('amendeSearchResultsContent');
    
    // Éléments pour la gestion des codes agents
    const generateAgentCodeBtn = document.getElementById('generateAgentCodeBtn');
    const agentCodeLoader = document.getElementById('agentCodeLoader');
    const agentCodeResult = document.getElementById('agentCodeResult');
    const recentAgentCodes = document.getElementById('recentAgentCodes');

    // Éléments pour l'émission d'amendes
    const emettreAmendeBtn = document.getElementById('emettreAmendeBtn');
    const amendeFormModal = document.getElementById('amendeFormModal');
    const amendeForm = document.getElementById('amendeForm');
    const submitAmendeBtn = document.getElementById('submitAmendeBtn');
    const amendeInfractionSelect = document.getElementById('amendeInfraction');
    const amendeMontantInput = document.getElementById('amendeMontant');
    const infractionDetailsSpan = document.getElementById('infractionDetails');

    // Variables globales pour la gestion des amendes
    let currentVehicleData = null;
    let infractionsData = [];

    // Gestion du formulaire de recherche de plaque
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            performPlateSearch();
        });
    }

    // Gestion du formulaire de recherche d'amende
    if (amendeSearchForm) {
        amendeSearchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            performAmendeSearch();
        });
    }

    // Gestion du bouton de génération de code agent
    console.log('generateAgentCodeBtn:', generateAgentCodeBtn);
    if (generateAgentCodeBtn) {
        console.log('Event listener ajouté au bouton de génération');
        generateAgentCodeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Bouton de génération cliqué');
            generateAgentCode();
        });
    } else {
        console.log('Bouton de génération non trouvé');
    }

    // Charger les codes agents récents au démarrage
    console.log('recentAgentCodes:', recentAgentCodes);
    if (recentAgentCodes) {
        console.log('Chargement des codes récents');
        loadRecentAgentCodes();
    } else {
        console.log('Element recentAgentCodes non trouvé');
    }

    // Charger les infractions au démarrage
    loadInfractions();

    // Gestionnaire pour le bouton "Émettre une amende"
    if (emettreAmendeBtn) {
        emettreAmendeBtn.addEventListener('click', function() {
            openAmendeModal();
        });
    }

    // Gestionnaire pour le changement d'infraction
    if (amendeInfractionSelect) {
        amendeInfractionSelect.addEventListener('change', function() {
            updateInfractionDetails();
        });
    }

    // Gestionnaire pour soumettre l'amende
    if (submitAmendeBtn) {
        submitAmendeBtn.addEventListener('click', function() {
            submitAmende();
        });
    }

    // Gestionnaire pour le bouton de géolocalisation
    const getLocationBtn = document.getElementById('getLocationBtn');
    if (getLocationBtn) {
        getLocationBtn.addEventListener('click', function() {
            getCurrentLocation();
        });
    }

    // Recherche en temps réel (optionnel - avec délai)
    let searchTimeout;
    if (plateSearchInput) {
        plateSearchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value.trim();
            
            if (query.length >= 3) {
                searchTimeout = setTimeout(() => {
                    performPlateSearch();
                }, 1000); // Délai de 1 seconde
            } else if (query.length === 0) {
                hideSearchResults();
            }
        });

        // Formatage automatique de la plaque (optionnel)
        plateSearchInput.addEventListener('input', function() {
            let value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            this.value = value;
        });
    }

    /**
     * Effectue la recherche de plaque via AJAX
     */
    function performPlateSearch() {
        const plateNumber = plateSearchInput.value.trim();
        
        if (!plateNumber) {
            showAlert('Veuillez saisir un numéro de plaque.', 'warning');
            return;
        }

        // Afficher le loader
        showLoader();
        hideSearchResults();

        // Effectuer la requête AJAX
        fetch(`/accounts/search-plate/?plate=${encodeURIComponent(plateNumber)}`, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            hideLoader();
            
            if (data.success) {
                displaySearchResults(data);
            } else {
                showAlert(data.message || 'Aucun résultat trouvé.', 'info');
            }
        })
        .catch(error => {
            hideLoader();
            console.error('Erreur lors de la recherche:', error);
            showAlert('Erreur lors de la recherche. Veuillez réessayer.', 'danger');
        });
    }

    /**
     * Effectue la recherche d'amende via AJAX
     */
    function performAmendeSearch() {
        const numeroAmende = amendeSearchInput.value.trim();
        
        if (!numeroAmende) {
            showAlert('Veuillez saisir un numéro d\'amende.', 'warning');
            return;
        }

        // Masquer les résultats de recherche de plaque
        hideSearchResults();
        
        // Afficher le loader d'amende
        showAmendeLoader();
        hideAmendeSearchResults();

        // Effectuer la requête AJAX
        fetch(`/accounts/search-amende/?numero=${encodeURIComponent(numeroAmende)}`, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            hideAmendeLoader();
            
            if (data.success) {
                displayAmendeSearchResults(data);
            } else {
                showAlert(data.message || 'Aucune amende trouvée.', 'info');
            }
        })
        .catch(error => {
            hideAmendeLoader();
            console.error('Erreur lors de la recherche d\'amende:', error);
            showAlert('Erreur lors de la recherche. Veuillez réessayer.', 'danger');
        });
    }

    /**
     * Affiche les résultats de recherche
     */
    function displaySearchResults(data) {
        let html = '';

        // Stocker les données du véhicule pour l'émission d'amende
        currentVehicleData = data.vehicle;

        // Afficher le bouton "Émettre une amende" si un véhicule est trouvé
        if (emettreAmendeBtn && data.vehicle) {
            emettreAmendeBtn.style.display = 'inline-block';
        } else if (emettreAmendeBtn) {
            emettreAmendeBtn.style.display = 'none';
        }

        // Informations du véhicule
        if (data.vehicle) {
            const vehicle = data.vehicle;
            const owner = vehicle.owner;
            
            html += `
                <div class="row">
                    <div class="col-md-6">
                        <h6 class="text-primary-changed mb-3">
                            <i class="fas fa-car me-2"></i>
                            Informations du véhicule
                        </h6>
                        <div class="card border-primary">
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-6">
                                        <strong>Plaque:</strong><br>
                                        <span class="badge btn-primary-changed-changed-changed-changed-changed fs-6">${vehicle.plate}</span>
                                    </div>
                                    <div class="col-6">
                                        <strong>Statut:</strong><br>
                                        ${vehicle.is_stolen ? 
                                            '<span class="badge bg-danger"><i class="fas fa-exclamation-triangle me-1"></i>VOLÉ</span>' : 
                                            '<span class="badge bg-succes-changed">Normal</span>'
                                        }
                                    </div>
                                </div>
                                <hr>
                                <div class="row">
                                    <div class="col-6">
                                        <strong>Marque:</strong> ${vehicle.brand}<br>
                                        <strong>Modèle:</strong> ${vehicle.model}
                                    </div>
                                    <div class="col-6">
                                        <strong>Couleur:</strong> ${vehicle.color}<br>
                                        <strong>Année:</strong> ${vehicle.year || 'N/A'}
                                    </div>
                                </div>
                                ${vehicle.is_stolen && vehicle.stolen_date ? 
                                    `<div class="alert alert-danger mt-2 mb-0">
                                        <i class="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Déclaré volé le:</strong> ${vehicle.stolen_date}
                                    </div>` : ''
                                }
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <h6 class="text-success mb-3">
                            <i class="fas fa-user me-2"></i>
                            Propriétaire
                        </h6>
                        <div class="card border-success">
                            <div class="card-body">
                                <div class="d-flex align-items-center mb-2">
                                    <div class="bg-succes-changed rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                                        <i class="fas fa-user text-white"></i>
                                    </div>
                                    <div>
                                        <strong>${owner.first_name} ${owner.last_name}</strong><br>
                                        <small class="text-muted">@${owner.username}</small>
                                    </div>
                                </div>
                                <hr>
                                <div>
                                    <i class="fas fa-envelope me-2 text-muted"></i>
                                    <span>${owner.email}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (data.message) {
            html += `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${data.message}
                </div>
            `;
        }

        // Historique des détections
        if (data.detections && data.detections.length > 0) {
            html += `
                <hr>
                <h6 class="text-info mb-3">
                    <i class="fas fa-history me-2"></i>
                    Historique des détections (${data.detections_count} au total)
                </h6>
                <div class="table-responsive">
                    <table class="table table-sm table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>Date/Heure</th>
                                <th>Plaque détectée</th>
                                <th>Agent</th>
                                <th>Média</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            data.detections.forEach(detection => {
                html += `
                    <tr>
                        <td>
                            <small>${detection.detection_date}</small>
                        </td>
                        <td>
                            <strong class="text-primary-changed">${detection.detected_plate}</strong>
                        </td>
                        <td>
                            <div>
                                <strong>${detection.agent.username}</strong>
                                ${detection.agent.agent_number ? 
                                    `<br><small class="text-muted">Agent ${detection.agent.agent_number}</small>` : ''
                                }
                            </div>
                        </td>
                        <td>
                            <div class="d-flex gap-1">
                                ${detection.has_image ? 
                                    '<span class="badge bg-info" title="Image"><i class="fas fa-image"></i></span>' : ''
                                }
                                ${detection.has_video ? 
                                    '<span class="badge bg-warning-changed" title="Vidéo"><i class="fas fa-video"></i></span>' : ''
                                }
                                ${!detection.has_image && !detection.has_video ? 
                                    '<span class="text-muted">-</span>' : ''
                                }
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Afficher les résultats
        searchResultsContent.innerHTML = html;
        showSearchResults();
    }

    /**
     * Affiche les résultats de recherche d'amende
     */
    function displayAmendeSearchResults(data) {
        const amende = data.amende;
        
        let html = `
            <div class="row">
                <!-- Informations de l'amende -->
                <div class="col-md-6">
                    <h6 class="text-warning mb-3">
                        <i class="fas fa-file-invoice-dollar me-2"></i>
                        Informations de l'amende
                    </h6>
                    <div class="card border-warning">
                        <div class="card-body">
                            <div class="row mb-3">
                                <div class="col-6">
                                    <strong>N° Amende:</strong><br>
                                    <span class="badge bg-warning-changed text-dark fs-6">${amende.numero_amende}</span>
                                </div>
                                <div class="col-6">
                                    <strong>Statut:</strong><br>
                                    <span class="badge ${getStatutBadgeClass(amende.statut)}">
                                        ${amende.statut_display}
                                    </span>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-6">
                                    <strong>Montant:</strong><br>
                                    <span class="text-danger fw-bold fs-5">${amende.montant.toLocaleString()} Z</span>
                                </div>
                                <div class="col-6">
                                    <strong>Date émission:</strong><br>
                                    <small>${amende.date_emission}</small>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-6">
                                    <strong>Limite paiement:</strong><br>
                                    <span class="text-danger">${amende.date_limite_paiement}</span>
                                </div>
                                <div class="col-6">
                                    <strong>Date paiement:</strong><br>
                                    <small>${amende.date_paiement || 'Non payée'}</small>
                                </div>
                            </div>
                            <div class="mb-3">
                                <strong>Lieu de l'infraction:</strong><br>
                                <span>${amende.lieu_infraction}</span>
                            </div>
                            ${amende.observations ? `
                                <div class="mb-3">
                                    <strong>Observations:</strong><br>
                                    <div class="bg-light p-2 rounded">
                                        <small>${amende.observations.replace(/\\n/g, '<br>')}</small>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Informations du véhicule et propriétaire -->
                <div class="col-md-6">
                    <h6 class="text-primary-changed mb-3">
                        <i class="fas fa-car me-2"></i>
                        Véhicule et propriétaire
                    </h6>
                    <div class="card border-primary">
                        <div class="card-body">
                            <div class="row mb-3">
                                <div class="col-6">
                                    <strong>Plaque:</strong><br>
                                    <span class="badge btn-primary-changed-changed fs-6">${amende.vehicle.plate}</span>
                                </div>
                                <div class="col-6">
                                    <strong>Statut véhicule:</strong><br>
                                    ${amende.vehicle.is_stolen ? 
                                        '<span class="badge bg-danger"><i class="fas fa-exclamation-triangle me-1"></i>VOLÉ</span>' : 
                                        '<span class="badge bg-succes-changed">Normal</span>'
                                    }
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-6">
                                    <strong>Marque:</strong> ${amende.vehicle.brand}<br>
                                    <strong>Modèle:</strong> ${amende.vehicle.model}
                                </div>
                                <div class="col-6">
                                    <strong>Couleur:</strong> ${amende.vehicle.color}<br>
                                    <strong>Année:</strong> ${amende.vehicle.year || 'N/A'}
                                </div>
                            </div>
                            <hr>
                            <div class="d-flex align-items-center mb-2">
                                <div class="bg-succes-changed rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                                    <i class="fas fa-user text-white"></i>
                                </div>
                                <div>
                                    <strong>${amende.vehicle.owner.first_name} ${amende.vehicle.owner.last_name}</strong><br>
                                    <small class="text-muted">@${amende.vehicle.owner.username}</small>
                                </div>
                            </div>
                            <div>
                                <i class="fas fa-envelope me-2 text-muted"></i>
                                <span>${amende.vehicle.owner.email}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Informations de l'infraction -->
            <hr>
            <div class="row">
                <div class="col-md-8">
                    <h6 class="text-danger mb-3">
                        <i class="fas fa-gavel me-2"></i>
                        Détails de l'infraction
                    </h6>
                    <div class="card border-danger">
                        <div class="card-body">
                            <div class="row">
                                <div class="col-4">
                                    <strong>Code article:</strong><br>
                                    <span class="badge bg-danger">${amende.infraction.code_article}</span>
                                </div>
                                <div class="col-4">
                                    <strong>Catégorie:</strong><br>
                                    <span class="badge bg-secondary">${amende.infraction.category}</span>
                                </div>
                                <div class="col-4">
                                    <strong>Montant de base:</strong><br>
                                    <span class="text-danger fw-bold">${amende.infraction.montant_base.toLocaleString()} Z</span>
                                </div>
                            </div>
                            <hr>
                            <div>
                                <strong>Description:</strong><br>
                                <p class="mb-0">${amende.infraction.description}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <h6 class="text-info mb-3">
                        <i class="fas fa-user-shield me-2"></i>
                        Agent verbalisateur
                    </h6>
                    <div class="card border-info">
                        <div class="card-body text-center">
                            <div class="bg-info rounded-circle d-inline-flex align-items-center justify-content-center mb-2" style="width: 50px; height: 50px;">
                                <i class="fas fa-user-shield text-white"></i>
                            </div>
                            <h6>${amende.agent.full_name}</h6>
                            <small class="text-muted">@${amende.agent.username}</small>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Actions de modification du statut -->
            <hr>
            <div class="card bg-light">
                <div class="card-header">
                    <h6 class="mb-0">
                        <i class="fas fa-edit me-2"></i>
                        Modifier le statut de l'amende
                    </h6>
                </div>
                <div class="card-body">
                    <form id="updateStatusForm" data-amende-id="${amende.id}">
                        <div class="row">
                            <div class="col-md-4">
                                <label for="newStatus" class="form-label">Nouveau statut:</label>
                                <select class="form-select" id="newStatus" name="statut" required>
                                    <option value="EMISE" ${amende.statut === 'EMISE' ? 'selected' : ''}>Émise</option>
                                    <option value="PAYEE" ${amende.statut === 'PAYEE' ? 'selected' : ''}>Payée</option>
                                    <option value="CONTESTEE" ${amende.statut === 'CONTESTEE' ? 'selected' : ''}>Contestée</option>
                                    <option value="ANNULEE" ${amende.statut === 'ANNULEE' ? 'selected' : ''}>Annulée</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label for="observations" class="form-label">Observations (optionnel):</label>
                                <textarea class="form-control" id="observations" name="observations" rows="2" placeholder="Ajouter une note..."></textarea>
                            </div>
                            <div class="col-md-2 d-flex align-items-end">
                                <button type="submit" class="btn btn-primary w-100">
                                    <i class="fas fa-save me-1"></i>
                                    Mettre à jour
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Afficher les résultats
        amendeSearchResultsContent.innerHTML = html;
        showAmendeSearchResults();

        // Attacher le gestionnaire d'événement pour la mise à jour du statut
        const updateForm = document.getElementById('updateStatusForm');
        if (updateForm) {
            updateForm.addEventListener('submit', function(e) {
                e.preventDefault();
                updateAmendeStatus(this);
            });
        }
    }

    /**
     * Affiche le loader de recherche
     */
    function showLoader() {
        if (searchLoader) {
            searchLoader.style.display = 'block';
        }
    }

    /**
     * Cache le loader de recherche
     */
    function hideLoader() {
        if (searchLoader) {
            searchLoader.style.display = 'none';
        }
    }

    /**
     * Affiche la section des résultats
     */
    function showSearchResults() {
        if (searchResults) {
            searchResults.style.display = 'block';
            searchResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Cache la section des résultats
     */
    function hideSearchResults() {
        if (searchResults) {
            searchResults.style.display = 'none';
        }
    }

    /**
     * Affiche une alerte en utilisant le système de toasts
     */
    function showAlert(message, type = 'info') {
        // Map Bootstrap alert types to toast types
        const toastType = type === 'danger' ? 'error' : type;
        
        // Use the global toast system
        if (window.showToast) {
            window.showToast(message, toastType);
        } else {
            // Fallback if toast system is not loaded
            console.warn('Toast system not available, falling back to console');
            console.log(`${toastType.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Réinitialise le formulaire de recherche
     */
    function resetSearch() {
        if (plateSearchInput) {
            plateSearchInput.value = '';
        }
        hideSearchResults();
        hideLoader();
    }

    // Bouton pour réinitialiser la recherche (si ajouté plus tard)
    const resetButton = document.getElementById('resetSearch');
    if (resetButton) {
        resetButton.addEventListener('click', resetSearch);
    }

    // Gestion des touches clavier
    document.addEventListener('keydown', function(e) {
        // Échap pour fermer les résultats
        if (e.key === 'Escape') {
            hideSearchResults();
        }
    });

    // Animation d'apparition pour les cartes
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observer les cartes pour l'animation
    document.querySelectorAll('.card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // Fonctions utilitaires pour les amendes
    
    /**
     * Affiche le loader de recherche d'amende
     */
    function showAmendeLoader() {
        if (amendeSearchLoader) {
            amendeSearchLoader.style.display = 'block';
        }
    }

    /**
     * Cache le loader de recherche d'amende
     */
    function hideAmendeLoader() {
        if (amendeSearchLoader) {
            amendeSearchLoader.style.display = 'none';
        }
    }

    /**
     * Affiche la section des résultats d'amende
     */
    function showAmendeSearchResults() {
        if (amendeSearchResults) {
            amendeSearchResults.style.display = 'block';
            amendeSearchResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Cache la section des résultats d'amende
     */
    function hideAmendeSearchResults() {
        if (amendeSearchResults) {
            amendeSearchResults.style.display = 'none';
        }
    }

    /**
     * Met à jour le statut d'une amende
     */
    function updateAmendeStatus(form) {
        const amendeId = form.dataset.amendeId;
        const formData = new FormData(form);
        formData.append('amende_id', amendeId);

        // Désactiver le bouton pendant la requête
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Mise à jour...';

        fetch('/accounts/update-amende-status/', {
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCsrfToken(),
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert(data.message, 'success');
                
                // Mettre à jour l'affichage du statut dans la page
                updateStatusDisplay(data.amende);
                
                // Vider le champ observations
                form.querySelector('textarea[name="observations"]').value = '';
            } else {
                showAlert(data.message || 'Erreur lors de la mise à jour', 'danger');
            }
        })
        .catch(error => {
            console.error('Erreur lors de la mise à jour:', error);
            showAlert('Erreur de connexion lors de la mise à jour', 'danger');
        })
        .finally(() => {
            // Réactiver le bouton
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        });
    }

    /**
     * Met à jour l'affichage du statut dans l'interface
     */
    function updateStatusDisplay(amendeData) {
        // Mettre à jour le badge de statut
        const statusBadge = document.querySelector('.badge');
        if (statusBadge && statusBadge.textContent.includes('Émise') || 
            statusBadge.textContent.includes('Payée') || 
            statusBadge.textContent.includes('Contestée') || 
            statusBadge.textContent.includes('Annulée')) {
            
            statusBadge.className = `badge ${getStatutBadgeClass(amendeData.statut)}`;
            statusBadge.textContent = amendeData.statut_display;
        }

        // Mettre à jour la date de paiement si applicable
        if (amendeData.date_paiement) {
            const paymentDateElements = document.querySelectorAll('small');
            paymentDateElements.forEach(element => {
                if (element.textContent === 'Non payée') {
                    element.textContent = amendeData.date_paiement;
                }
            });
        }

        // Mettre à jour les observations si présentes
        if (amendeData.observations) {
            const observationsDiv = document.querySelector('.bg-light.p-2.rounded small');
            if (observationsDiv) {
                observationsDiv.innerHTML = amendeData.observations.replace(/\n/g, '<br>');
            }
        }
    }

    /**
     * Génère un nouveau code agent
     */
    function generateAgentCode() {
        console.log('generateAgentCode() appelée');
        console.log('generateAgentCodeBtn:', generateAgentCodeBtn);
        console.log('agentCodeLoader:', agentCodeLoader);
        console.log('agentCodeResult:', agentCodeResult);
        
        if (!generateAgentCodeBtn || !agentCodeLoader || !agentCodeResult) {
            console.error('Éléments manquants pour la génération de code');
            return;
        }
        
        console.log('Affichage du loader...');
        // Afficher le loader
        agentCodeLoader.style.display = 'block';
        agentCodeResult.style.display = 'none';
        generateAgentCodeBtn.disabled = true;
        
        console.log('Envoi de la requête fetch...');
        fetch('/accounts/generate-agent-code/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            }
        })
        .then(response => {
            console.log('Réponse reçue:', response);
            return response.json();
        })
        .then(data => {
            console.log('Données reçues:', data);
            agentCodeLoader.style.display = 'none';
            generateAgentCodeBtn.disabled = false;
            
            if (data.success) {
                console.log('Génération réussie');
                displayGeneratedCode(data.code);
                loadRecentAgentCodes(); // Recharger la liste
                if (window.showSuccess) {
                    window.showSuccess(data.message);
                }
            } else {
                console.log('Erreur dans la réponse:', data.message);
                if (window.showError) {
                    window.showError(data.message);
                } else {
                    console.error('Erreur:', data.message);
                }
            }
        })
        .catch(error => {
            console.error('Erreur lors de la génération du code:', error);
            agentCodeLoader.style.display = 'none';
            generateAgentCodeBtn.disabled = false;
            
            if (window.showError) {
                window.showError('Erreur de connexion lors de la génération du code');
            }
        });
    }

    /**
     * Affiche le code généré
     */
    function displayGeneratedCode(code) {
        if (!agentCodeResult) return;
        
        agentCodeResult.innerHTML = `
            <div class="alert alert-success">
                <h6 class="alert-heading">
                    <i class="fas fa-check-circle me-2"></i>
                    Code généré avec succès !
                </h6>
                <div class="text-center my-3">
                    <div class="bg-light p-3 rounded border" style="font-size: 2rem; font-weight: bold; letter-spacing: 0.5rem; color: #28a745;">
                        ${code.code}
                    </div>
                </div>
                <hr>
                <small class="text-muted">
                    <i class="fas fa-info-circle me-1"></i>
                    Ce code peut maintenant être utilisé pour l'inscription d'un nouvel agent.
                    <br>
                    <strong>Créé le:</strong> ${code.created_at}
                </small>
            </div>
        `;
        
        agentCodeResult.style.display = 'block';
    }

    /**
     * Charge la liste des codes agents récents
     */
    function loadRecentAgentCodes() {
        if (!recentAgentCodes) return;
        
        fetch('/accounts/get-recent-agent-codes/')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayRecentAgentCodes(data.codes);
            } else {
                console.error('Erreur lors du chargement des codes:', data.message);
            }
        })
        .catch(error => {
            console.error('Erreur lors du chargement des codes:', error);
        });
    }

    /**
     * Affiche la liste des codes agents récents
     */
    function displayRecentAgentCodes(codes) {
        if (!recentAgentCodes) return;
        
        if (codes.length === 0) {
            recentAgentCodes.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-key fa-2x text-muted mb-2"></i>
                    <p class="text-muted mb-0">Aucun code généré</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="table-responsive"><table class="table table-sm mb-0">';
        html += `
            <thead class="table-light">
                <tr>
                    <th>Code</th>
                    <th>Créé le</th>
                    <th>Statut</th>
                    <th>Utilisé par</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        codes.forEach(code => {
            const statusBadge = code.is_used 
                ? '<span class="badge bg-danger">Utilisé</span>'
                : '<span class="badge bg-succes-changed">Disponible</span>';
            
            const usedBy = code.used_by 
                ? `<small>${code.used_by}<br><span class="text-muted">${code.used_at}</span></small>`
                : '<span class="text-muted">-</span>';
            
            html += `
                <tr>
                    <td><code>${code.code}</code></td>
                    <td><small>${code.created_at}</small></td>
                    <td>${statusBadge}</td>
                    <td>${usedBy}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        recentAgentCodes.innerHTML = html;
    }

    /**
     * Obtient le token CSRF
     */
    function getCsrfToken() {
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');
        if (csrfToken) {
            return csrfToken.value;
        }
        
        // Fallback: chercher dans les cookies
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        return '';
    }

    // ============================================================================
    // FONCTIONS POUR L'ÉMISSION D'AMENDES
    // ============================================================================

    /**
     * Charge la liste des infractions depuis le serveur
     */
    function loadInfractions() {
        fetch('/accounts/get-infractions/', {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                infractionsData = data.infractions;
                populateInfractionSelect();
            } else {
                console.error('Erreur lors du chargement des infractions:', data.message);
            }
        })
        .catch(error => {
            console.error('Erreur lors du chargement des infractions:', error);
        });
    }

    /**
     * Remplit le select des infractions
     */
    function populateInfractionSelect() {
        if (!amendeInfractionSelect) return;

        // Vider le select sauf l'option par défaut
        amendeInfractionSelect.innerHTML = '<option value="">-- Sélectionnez une infraction --</option>';

        // Grouper par catégorie
        const grouped = {};
        infractionsData.forEach(infraction => {
            const category = infraction.category_display || infraction.category;
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(infraction);
        });

        // Ajouter les options groupées
        Object.keys(grouped).forEach(category => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category;

            grouped[category].forEach(infraction => {
                const option = document.createElement('option');
                option.value = infraction.id;
                option.textContent = `${infraction.code_article} - ${infraction.description.substring(0, 80)}${infraction.description.length > 80 ? '...' : ''}`;
                option.dataset.montant = infraction.montant_base;
                option.dataset.description = infraction.description;
                option.dataset.code = infraction.code_article;
                optgroup.appendChild(option);
            });

            amendeInfractionSelect.appendChild(optgroup);
        });
    }

    /**
     * Met à jour les détails de l'infraction sélectionnée
     */
    function updateInfractionDetails() {
        const selectedOption = amendeInfractionSelect.options[amendeInfractionSelect.selectedIndex];

        if (selectedOption && selectedOption.value) {
            const montant = selectedOption.dataset.montant;
            const description = selectedOption.dataset.description;

            // Mettre à jour le montant
            if (amendeMontantInput) {
                amendeMontantInput.value = `${parseFloat(montant).toLocaleString('fr-FR')} Fc`;
            }

            // Mettre à jour les détails
            if (infractionDetailsSpan) {
                infractionDetailsSpan.innerHTML = `<i class="fas fa-info-circle me-1"></i>${description}`;
            }
        } else {
            if (amendeMontantInput) amendeMontantInput.value = '';
            if (infractionDetailsSpan) infractionDetailsSpan.innerHTML = '';
        }
    }

    /**
     * Ouvre la modal d'émission d'amende
     */
    function openAmendeModal() {
        if (!currentVehicleData) {
            if (window.showError) {
                window.showError('Aucun véhicule sélectionné');
            } else {
                alert('Aucun véhicule sélectionné');
            }
            return;
        }

        // Remplir les informations du véhicule
        const vehicleInfoDiv = document.getElementById('amendeVehicleInfo');
        if (vehicleInfoDiv) {
            vehicleInfoDiv.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <strong>Plaque:</strong> <span class="badge btn-primary-changed-changed fs-6">${currentVehicleData.plate}</span>
                    </div>
                    <div class="col-md-6">
                        <strong>Véhicule:</strong> ${currentVehicleData.brand} ${currentVehicleData.model}
                    </div>
                </div>
                <div class="row mt-2">
                    <div class="col-md-6">
                        <strong>Couleur:</strong> ${currentVehicleData.color}
                    </div>
                    <div class="col-md-6">
                        <strong>Propriétaire:</strong> ${currentVehicleData.owner.first_name} ${currentVehicleData.owner.last_name}
                    </div>
                </div>
            `;
        }

        // Définir l'ID du véhicule
        document.getElementById('amendeVehicleId').value = currentVehicleData.id;

        // Réinitialiser le formulaire
        amendeForm.reset();
        document.getElementById('amendeVehicleId').value = currentVehicleData.id;
        if (amendeMontantInput) amendeMontantInput.value = '';
        if (infractionDetailsSpan) infractionDetailsSpan.innerHTML = '';

        // Ouvrir la modal
        const modal = new bootstrap.Modal(amendeFormModal);
        modal.show();
    }

    /**
     * Soumet le formulaire d'amende
     */
    function submitAmende() {
        // Validation
        const vehicleId = document.getElementById('amendeVehicleId').value;
        const infractionId = amendeInfractionSelect.value;
        const lieu = document.getElementById('amendeLieu').value.trim();

        if (!vehicleId || !infractionId || !lieu) {
            showAlert('Veuillez remplir tous les champs obligatoires', 'warning');
            return;
        }

        // Désactiver le bouton pendant l'envoi
        const originalText = submitAmendeBtn.innerHTML;
        submitAmendeBtn.disabled = true;
        submitAmendeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Émission en cours...';

        // Récupérer les coordonnées GPS si disponibles
        const latitude = document.getElementById('amendeLatitude').value;
        const longitude = document.getElementById('amendeLongitude').value;

        // Préparer les données
        const amendeData = {
            vehicle_id: vehicleId,
            infraction_id: infractionId,
            lieu_infraction: lieu,
            observations: document.getElementById('amendeObservations').value.trim()
        };

        // Ajouter les coordonnées GPS si elles sont disponibles
        if (latitude && longitude) {
            amendeData.latitude = parseFloat(latitude);
            amendeData.longitude = parseFloat(longitude);
        }

        // Envoyer la requête
        fetch('/accounts/emettre-amende/', {
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(amendeData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert(data.message, 'success');
                
                // Fermer la modal
                const modal = bootstrap.Modal.getInstance(amendeFormModal);
                modal.hide();

                // Réinitialiser le formulaire
                amendeForm.reset();

                // Afficher les détails de l'amende
                displayAmendeSuccess(data.amende);
            } else {
                showAlert(data.message || 'Erreur lors de l\'émission de l\'amende', 'danger');
            }
        })
        .catch(error => {
            console.error('Erreur lors de l\'émission de l\'amende:', error);
            showAlert('Erreur de connexion lors de l\'émission de l\'amende', 'danger');
        })
        .finally(() => {
            // Réactiver le bouton
            submitAmendeBtn.disabled = false;
            submitAmendeBtn.innerHTML = originalText;
        });
    }

    /**
     * Affiche le succès de l'émission d'amende
     */
    function displayAmendeSuccess(amende) {
        const successHtml = `
            <div class="alert alert-success alert-dismissible fade show mt-3" role="alert">
                <h5 class="alert-heading">
                    <i class="fas fa-check-circle me-2"></i>Amende émise avec succès !
                </h5>
                <hr>
                <p class="mb-2"><strong>Numéro d'amende:</strong> <code>${amende.numero}</code></p>
                <p class="mb-2"><strong>Montant:</strong> <span class="text-danger fw-bold">${amende.montant.toLocaleString('fr-FR')} Fc</span></p>
                <p class="mb-2"><strong>Infraction:</strong> ${amende.code_article} - ${amende.infraction}</p>
                <p class="mb-2"><strong>Date d'émission:</strong> ${amende.date_emission}</p>
                <p class="mb-2"><strong>Date limite de paiement:</strong> ${amende.date_limite}</p>
                ${amende.email_envoye ? 
                    '<p class="mb-0 text-success"><i class="fas fa-envelope me-2"></i>Email de notification envoyé au propriétaire</p>' :
                    '<p class="mb-0 text-warning"><i class="fas fa-exclamation-triangle me-2"></i>Email non envoyé (vérifier la configuration)</p>'
                }
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;

        // Insérer le message de succès au début des résultats
        const resultsContent = document.getElementById('searchResultsContent');
        if (resultsContent) {
            resultsContent.insertAdjacentHTML('afterbegin', successHtml);
        }
    }

    /**
     * Obtenir la géolocalisation actuelle de l'utilisateur
     */
    function getCurrentLocation() {
        const locationBtn = document.getElementById('getLocationBtn');
        const locationInfo = document.getElementById('locationInfo');
        const locationError = document.getElementById('locationError');
        const locationCoords = document.getElementById('locationCoords');
        const locationAccuracy = document.getElementById('locationAccuracy');
        const locationErrorMsg = document.getElementById('locationErrorMsg');
        const latitudeInput = document.getElementById('amendeLatitude');
        const longitudeInput = document.getElementById('amendeLongitude');
        const lieuInput = document.getElementById('amendeLieu');

        // Vérifier si la géolocalisation est supportée
        if (!navigator.geolocation) {
            locationError.style.display = 'block';
            locationInfo.style.display = 'none';
            locationErrorMsg.textContent = 'La géolocalisation n\'est pas supportée par votre navigateur.';
            if (window.showError) {
                window.showError('Géolocalisation non supportée');
            }
            return;
        }

        // Afficher un loader sur le bouton
        const originalBtnContent = locationBtn.innerHTML;
        locationBtn.disabled = true;
        locationBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Localisation...';

        // Masquer les messages précédents
        locationInfo.style.display = 'none';
        locationError.style.display = 'none';

        // Options de géolocalisation pour une précision maximale
        const options = {
            enableHighAccuracy: true,  // Précision maximale
            timeout: 10000,            // Timeout de 10 secondes
            maximumAge: 0              // Pas de cache, position fraîche
        };

        // Obtenir la position
        navigator.geolocation.getCurrentPosition(
            // Succès
            function(position) {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                // Stocker les coordonnées dans les champs cachés
                latitudeInput.value = latitude.toFixed(6);
                longitudeInput.value = longitude.toFixed(6);

                // Afficher les coordonnées
                locationCoords.textContent = `Lat: ${latitude.toFixed(6)}, Long: ${longitude.toFixed(6)}`;
                locationAccuracy.textContent = `(Précision: ±${Math.round(accuracy)}m)`;
                locationInfo.style.display = 'block';
                locationError.style.display = 'none';

                // Tenter de récupérer l'adresse via reverse geocoding (Nominatim - OpenStreetMap)
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
                    headers: {
                        'User-Agent': 'VehicleDetectionApp/1.0'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data && data.display_name) {
                        // Remplir automatiquement le champ lieu avec l'adresse
                        lieuInput.value = data.display_name;
                        if (window.showSuccess) {
                            window.showSuccess(`Position GPS capturée avec succès (±${Math.round(accuracy)}m)`);
                        }
                    }
                })
                .catch(error => {
                    console.log('Reverse geocoding échoué, coordonnées GPS enregistrées:', error);
                    if (window.showSuccess) {
                        window.showSuccess(`Coordonnées GPS capturées (±${Math.round(accuracy)}m)`);
                    }
                });

                // Restaurer le bouton
                locationBtn.disabled = false;
                locationBtn.innerHTML = originalBtnContent;
            },
            // Erreur
            function(error) {
                let errorMessage = '';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Permission de géolocalisation refusée. Veuillez autoriser l\'accès à votre position.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Position indisponible. Vérifiez que le GPS est activé.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Délai d\'attente dépassé. Réessayez.';
                        break;
                    default:
                        errorMessage = 'Erreur inconnue lors de la géolocalisation.';
                }

                locationErrorMsg.textContent = errorMessage;
                locationError.style.display = 'block';
                locationInfo.style.display = 'none';

                if (window.showError) {
                    window.showError(errorMessage);
                }

                // Restaurer le bouton
                locationBtn.disabled = false;
                locationBtn.innerHTML = originalBtnContent;
            },
            options
        );
    }
});

// Fonction utilitaire pour formater les numéros de plaque
function formatPlateNumber(input) {
    // Exemple de formatage pour les plaques françaises
    let value = input.replace(/[^A-Z0-9]/g, '');
    
    // Format: AB-123-CD
    if (value.length > 2 && value.length <= 5) {
        value = value.substring(0, 2) + '-' + value.substring(2);
    } else if (value.length > 5) {
        value = value.substring(0, 2) + '-' + value.substring(2, 5) + '-' + value.substring(5, 7);
    }
    
    return value;
}

// Fonction utilitaire pour obtenir la classe CSS du badge de statut
function getStatutBadgeClass(statut) {
    const classes = {
        'EMISE': 'bg-warning-changed text-dark',
        'PAYEE': 'bg-succes-changed',
        'CONTESTEE': 'bg-info',
        'ANNULEE': 'bg-secondary'
    };
    return classes[statut] || 'bg-secondary';
}
