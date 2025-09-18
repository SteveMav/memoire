/**
 * JavaScript pour l'espace agent - Gestion des recherches asynchrones
 */

document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const plateSearchInput = document.getElementById('plateSearch');
    const searchLoader = document.getElementById('searchLoader');
    const searchResults = document.getElementById('searchResults');
    const searchResultsContent = document.getElementById('searchResultsContent');

    // Gestion du formulaire de recherche
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            performPlateSearch();
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
     * Affiche une alerte
     */
    function showAlert(message, type = 'info') {
        // Créer l'alerte
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insérer l'alerte au début du contenu principal
        const mainContent = document.querySelector('.col-md-9');
        if (mainContent) {
            mainContent.insertBefore(alertDiv, mainContent.firstChild);
        }

        // Auto-fermeture après 5 secondes
        setTimeout(() => {
            if (alertDiv && alertDiv.parentNode) {
                const bsAlert = new bootstrap.Alert(alertDiv);
                bsAlert.close();
            }
        }, 5000);
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
