/**
 * Système de gestion des amendes des véhicules
 * Version simplifiée et robuste
 */

// Variables globales
let amendesModal = null;
let isInitialized = false;

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚗 Système des amendes - Chargement...');
    
    // Attendre que tous les scripts soient chargés
    setTimeout(initializeAmendesSystem, 300);
});

/**
 * Initialisation complète du système
 */
function initializeAmendesSystem() {
    console.log('🔧 Initialisation du système des amendes...');
    
    try {
        // Vérifier les prérequis
        if (!checkPrerequisites()) {
            console.error('❌ Prérequis manquants');
            return;
        }
        
        // Initialiser la modal
        initializeModal();
        
        // Attacher les gestionnaires d'événements
        attachEventHandlers();
        
        isInitialized = true;
        console.log('✅ Système des amendes initialisé avec succès');
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
    }
}

/**
 * Vérifier que tous les prérequis sont présents
 */
function checkPrerequisites() {
    // Vérifier Bootstrap
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap non trouvé');
        return false;
    }
    
    // Vérifier la modal
    const modalElement = document.getElementById('amendesModal');
    if (!modalElement) {
        console.error('Modal amendesModal non trouvée');
        return false;
    }
    
    // Vérifier les boutons
    const buttons = document.querySelectorAll('.view-amendes-btn');
    console.log(`📋 ${buttons.length} bouton(s) "Voir amendes" trouvé(s)`);
    
    return true;
}

/**
 * Initialiser la modal Bootstrap
 */
function initializeModal() {
    const modalElement = document.getElementById('amendesModal');
    amendesModal = new bootstrap.Modal(modalElement, {
        backdrop: 'static',
        keyboard: true
    });
    console.log('🎭 Modal initialisée');
}

/**
 * Attacher les gestionnaires d'événements
 */
function attachEventHandlers() {
    console.log('🔗 Attachement des gestionnaires d\'événements...');
    
    // Utiliser la délégation d'événements sur le document
    document.addEventListener('click', handleAmendesButtonClick);
    
    console.log('📎 Gestionnaires attachés');
}

/**
 * Gestionnaire de clic pour les boutons d'amendes
 */
function handleAmendesButtonClick(event) {
    // Vérifier si c'est un bouton d'amendes qui a été cliqué
    const amendesBtn = event.target.closest('.view-amendes-btn');
    
    if (!amendesBtn) {
        return; // Ce n'est pas notre bouton
    }
    
    console.log('🎯 Bouton amendes cliqué!');
    
    // Empêcher le comportement par défaut
    event.preventDefault();
    event.stopPropagation();
    
    // Récupérer l'ID du véhicule
    const vehicleId = amendesBtn.dataset.vehicleId;
    
    if (!vehicleId) {
        console.error('❌ ID du véhicule manquant');
        showNotification('error', 'ID du véhicule manquant');
        return;
    }
    
    console.log(`🚗 Chargement des amendes pour le véhicule ${vehicleId}`);
    
    // Afficher les amendes
    showVehicleAmendes(vehicleId);
}

/**
 * Afficher les amendes d'un véhicule
 */
function showVehicleAmendes(vehicleId) {
    console.log(`📋 Affichage des amendes pour le véhicule ${vehicleId}`);
    
    if (!isInitialized) {
        console.error('❌ Système non initialisé');
        showNotification('error', 'Système non initialisé');
        return;
    }
    
    // Réinitialiser et afficher la modal
    resetModal();
    amendesModal.show();
    
    // Charger les données via AJAX
    loadAmendesData(vehicleId);
}

/**
 * Charger les données des amendes via AJAX
 */
function loadAmendesData(vehicleId) {
    const url = `/vehicules/amendes/${vehicleId}/`;
    console.log(`🌐 Chargement depuis: ${url}`);
    
    fetch(url, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        console.log(`📡 Réponse reçue: ${response.status}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    })
    .then(data => {
        console.log('📊 Données reçues:', data);
        
        if (data.success) {
            displayAmendesData(data.amendes, data.vehicle);
        } else {
            throw new Error(data.error || 'Erreur inconnue du serveur');
        }
    })
    .catch(error => {
        console.error('❌ Erreur de chargement:', error);
        showNotification('error', `Erreur: ${error.message}`);
        hideLoadingSpinner();
    });
}

/**
 * Réinitialiser la modal
 */
function resetModal() {
    console.log('🔄 Réinitialisation de la modal...');
    
    // Afficher le spinner
    showLoadingSpinner();
    
    // Masquer le contenu et le message "aucune amende"
    hideElement('amendesContent');
    hideElement('noAmendesMessage');
    
    // Vider le contenu précédent
    clearElement('vehicleInfo');
    clearElement('amendesTableContainer');
}

/**
 * Afficher le spinner de chargement
 */
function showLoadingSpinner() {
    showElement('amendesLoadingSpinner');
}

/**
 * Masquer le spinner de chargement
 */
function hideLoadingSpinner() {
    hideElement('amendesLoadingSpinner');
}

/**
 * Afficher les données des amendes
 */
function displayAmendesData(amendes, vehicle) {
    console.log(`📊 Affichage de ${amendes.length} amende(s)`);
    
    hideLoadingSpinner();
    
    // Mettre à jour les informations du véhicule
    const vehicleInfo = `${vehicle.plate} - ${vehicle.brand} ${vehicle.model}`;
    setElementText('vehicleInfo', vehicleInfo);
    
    if (amendes.length === 0) {
        // Aucune amende trouvée
        showElement('noAmendesMessage');
        console.log('ℹ️ Aucune amende trouvée');
    } else {
        // Afficher les amendes
        showElement('amendesContent');
        
        // Créer et insérer le tableau
        const tableHtml = createAmendesTable(amendes);
        setElementHTML('amendesTableContainer', tableHtml);
        
        console.log('✅ Amendes affichées avec succès');
    }
}

/**
 * Créer le tableau HTML des amendes
 */
function createAmendesTable(amendes) {
    console.log('🏗️ Création du tableau des amendes...');
    
    let html = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th><i class="fas fa-hashtag me-1"></i>N° Amende</th>
                        <th><i class="fas fa-gavel me-1"></i>Infraction</th>
                        <th><i class="fas fa-money-bill-wave me-1"></i>Montant</th>
                        <th><i class="fas fa-info-circle me-1"></i>Statut</th>
                        <th><i class="fas fa-calendar me-1"></i>Date émission</th>
                        <th><i class="fas fa-calendar-check me-1"></i>Limite paiement</th>
                        <th><i class="fas fa-map-marker-alt me-1"></i>Lieu</th>
                        <th><i class="fas fa-user-tie me-1"></i>Agent</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    amendes.forEach(amende => {
        const statutClass = getStatutClass(amende.statut);
        const statutIcon = getStatutIcon(amende.statut);
        
        html += `
            <tr>
                <td class="fw-bold">${escapeHtml(amende.numero_amende)}</td>
                <td>
                    <div>
                        <strong>${escapeHtml(amende.infraction.code_article)}</strong>
                        <br>
                        <small class="text-muted">${truncateText(escapeHtml(amende.infraction.description), 50)}</small>
                        <br>
                        <span class="badge bg-secondary">${escapeHtml(amende.infraction.category)}</span>
                    </div>
                </td>
                <td class="fw-bold text-warning">${formatCurrency(amende.montant)}</td>
                <td>
                    <span class="badge ${statutClass}">
                        <i class="fas ${statutIcon} me-1"></i>${escapeHtml(amende.statut_display)}
                    </span>
                </td>
                <td>${escapeHtml(amende.date_emission)}</td>
                <td class="text-danger fw-semibold">${escapeHtml(amende.date_limite_paiement)}</td>
                <td>${escapeHtml(amende.lieu_infraction)}</td>
                <td>${escapeHtml(amende.agent)}</td>
            </tr>
        `;
        
        // Ajouter une ligne pour les observations si elles existent
        if (amende.observations && amende.observations.trim()) {
            html += `
                <tr class="table-light">
                    <td></td>
                    <td colspan="7">
                        <small class="text-muted">
                            <i class="fas fa-comment me-1"></i>
                            <strong>Observations :</strong> ${escapeHtml(amende.observations)}
                        </small>
                    </td>
                </tr>
            `;
        }
    });
    
    html += `
                </tbody>
            </table>
        </div>
        
        <!-- Résumé des amendes -->
        <div class="row mt-4">
            <div class="col-md-4">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <i class="fas fa-file-invoice-dollar fa-2x text-primary mb-2"></i>
                        <h5>${amendes.length}</h5>
                        <p class="text-muted mb-0">Total amendes</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <i class="fas fa-money-bill-wave fa-2x text-warning mb-2"></i>
                        <h5>${formatCurrency(calculateTotalAmount(amendes))}</h5>
                        <p class="text-muted mb-0">Montant total</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <i class="fas fa-exclamation-circle fa-2x text-danger mb-2"></i>
                        <h5>${countUnpaidAmendes(amendes)}</h5>
                        <p class="text-muted mb-0">Non payées</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Obtenir la classe CSS pour le statut d'amende
 */
function getStatutClass(statut) {
    const classes = {
        'EMISE': 'bg-warning',
        'PAYEE': 'bg-success',
        'CONTESTEE': 'bg-info',
        'ANNULEE': 'bg-secondary'
    };
    return classes[statut] || 'bg-secondary';
}

/**
 * Obtenir l'icône pour le statut d'amende
 */
function getStatutIcon(statut) {
    const icons = {
        'EMISE': 'fa-clock',
        'PAYEE': 'fa-check-circle',
        'CONTESTEE': 'fa-question-circle',
        'ANNULEE': 'fa-times-circle'
    };
    return icons[statut] || 'fa-info-circle';
}

/**
 * Tronquer le texte à une longueur maximale
 */
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Calculer le montant total des amendes
 */
function calculateTotalAmount(amendes) {
    return amendes.reduce((total, amende) => total + (amende.montant || 0), 0);
}

/**
 * Compter les amendes non payées
 */
function countUnpaidAmendes(amendes) {
    return amendes.filter(amende => 
        amende.statut === 'EMISE' || amende.statut === 'CONTESTEE'
    ).length;
}

/**
 * Formater un montant en devise
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' Z';
}

/**
 * Échapper les caractères HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// FONCTIONS DOM UTILITAIRES
// ============================================================================

/**
 * Afficher un élément
 */
function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
    }
}

/**
 * Masquer un élément
 */
function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

/**
 * Vider le contenu d'un élément
 */
function clearElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = '';
    }
}

/**
 * Définir le texte d'un élément
 */
function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

/**
 * Définir le HTML d'un élément
 */
function setElementHTML(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = html;
    }
}

// ============================================================================
// SYSTÈME DE NOTIFICATIONS
// ============================================================================

/**
 * Afficher une notification (utilise le système de toasts si disponible)
 */
function showNotification(type, message) {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    
    // Essayer d'utiliser le système de toasts
    const toastFunction = window[`show${type.charAt(0).toUpperCase() + type.slice(1)}`];
    
    if (typeof toastFunction === 'function') {
        toastFunction(message);
    } else {
        // Fallback vers les alertes classiques
        if (type === 'error') {
            alert(`Erreur: ${message}`);
        } else {
            console.log(`${type}: ${message}`);
        }
    }
}

// ============================================================================
// FONCTIONS DE TEST ET DEBUG
// ============================================================================

/**
 * Fonction de test complète du système
 */
window.testAmendesSystem = function() {
    console.log('🧪 === TEST DU SYSTÈME D\'AMENDES ===');
    
    // Test des prérequis
    console.log('🔍 Vérification des prérequis...');
    const modal = document.getElementById('amendesModal');
    const buttons = document.querySelectorAll('.view-amendes-btn');
    
    console.log(`🎭 Modal trouvée: ${!!modal}`);
    console.log(`🔘 Boutons trouvés: ${buttons.length}`);
    console.log(`📦 Bootstrap disponible: ${typeof bootstrap !== 'undefined'}`);
    console.log(`🍞 Système de toasts: ${typeof window.showError === 'function'}`);
    console.log(`⚙️ Système initialisé: ${isInitialized}`);
    
    // Test de fonctionnement
    if (buttons.length > 0) {
        console.log('🎯 Test de clic sur le premier bouton...');
        const firstBtn = buttons[0];
        const vehicleId = firstBtn.dataset.vehicleId;
        
        console.log(`🚗 ID du véhicule: ${vehicleId}`);
        
        if (vehicleId) {
            console.log('🖱️ Simulation du clic...');
            firstBtn.click();
        } else {
            console.error('❌ ID du véhicule manquant');
        }
    } else {
        console.warn('⚠️ Aucun bouton trouvé pour le test');
    }
    
    console.log('✅ === FIN DU TEST ===');
};

/**
 * Réinitialiser le système manuellement
 */
window.reinitAmendesSystem = function() {
    console.log('🔄 Réinitialisation manuelle du système...');
    isInitialized = false;
    initializeAmendesSystem();
};
