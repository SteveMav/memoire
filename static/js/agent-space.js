/**
 * JavaScript pour l'espace agent - Gestion des recherches asynchrones
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

        // Informations du véhicule
        if (data.vehicle) {
            const vehicle = data.vehicle;
            const owner = vehicle.owner;
            
            html += `
                <div class="row">
                    <div class="col-md-6">
                        <h6 class="text-primary mb-3">
                            <i class="fas fa-car me-2"></i>
                            Informations du véhicule
                        </h6>
                        <div class="card border-primary">
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-6">
                                        <strong>Plaque:</strong><br>
                                        <span class="badge bg-primary fs-6">${vehicle.plate}</span>
                                    </div>
                                    <div class="col-6">
                                        <strong>Statut:</strong><br>
                                        ${vehicle.is_stolen ? 
                                            '<span class="badge bg-danger"><i class="fas fa-exclamation-triangle me-1"></i>VOLÉ</span>' : 
                                            '<span class="badge bg-success">Normal</span>'
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
                                    <div class="bg-success rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
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
                            <strong class="text-primary">${detection.detected_plate}</strong>
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
                                    '<span class="badge bg-warning" title="Vidéo"><i class="fas fa-video"></i></span>' : ''
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
                                    <span class="badge bg-warning text-dark fs-6">${amende.numero_amende}</span>
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
                    <h6 class="text-primary mb-3">
                        <i class="fas fa-car me-2"></i>
                        Véhicule et propriétaire
                    </h6>
                    <div class="card border-primary">
                        <div class="card-body">
                            <div class="row mb-3">
                                <div class="col-6">
                                    <strong>Plaque:</strong><br>
                                    <span class="badge bg-primary fs-6">${amende.vehicle.plate}</span>
                                </div>
                                <div class="col-6">
                                    <strong>Statut véhicule:</strong><br>
                                    ${amende.vehicle.is_stolen ? 
                                        '<span class="badge bg-danger"><i class="fas fa-exclamation-triangle me-1"></i>VOLÉ</span>' : 
                                        '<span class="badge bg-success">Normal</span>'
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
                                <div class="bg-success rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
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
        'EMISE': 'bg-warning text-dark',
        'PAYEE': 'bg-success',
        'CONTESTEE': 'bg-info',
        'ANNULEE': 'bg-secondary'
    };
    return classes[statut] || 'bg-secondary';
}
