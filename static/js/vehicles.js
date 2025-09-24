// Vehicle Management JavaScript - Completely Rewritten
document.addEventListener('DOMContentLoaded', function() {
    
    // Modal elements
    const addVehicleModal = new bootstrap.Modal(document.getElementById('addVehicleModal'));
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const addVehicleForm = document.getElementById('addVehicleForm');
    
    // Modal event handlers
    const addVehicleBtn = document.getElementById('addVehicleBtn');
    const addFirstVehicleBtn = document.getElementById('addFirstVehicleBtn');
    
    // Show add vehicle modal
    function showAddVehicleModal() {
        // Reset form
        if (addVehicleForm) {
            addVehicleForm.reset();
            addVehicleForm.classList.remove('was-validated');
            // Clear any validation states
            const inputs = addVehicleForm.querySelectorAll('.form-control');
            inputs.forEach(input => {
                input.classList.remove('is-invalid', 'is-valid');
            });
        }
        addVehicleModal.show();
    }
    
    // Event listeners for modal triggers
    if (addVehicleBtn) {
        addVehicleBtn.addEventListener('click', showAddVehicleModal);
    }
    if (addFirstVehicleBtn) {
        addFirstVehicleBtn.addEventListener('click', showAddVehicleModal);
    }
    
    // Get CSRF token
    function getCSRFToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return decodeURIComponent(value);
            }
        }
        return '';
    }

    // Show toast message using the global toast system
    function showAlert(message, type) {
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
    
    // Show modal alert message using toast system
    function showModalAlert(message, type) {
        // Map Bootstrap alert types to toast types
        const toastType = type === 'danger' ? 'error' : type;
        
        // Use the global toast system for modal alerts too
        if (window.showToast) {
            window.showToast(message, toastType);
        } else {
            // Fallback if toast system is not loaded
            console.warn('Toast system not available, falling back to console');
            console.log(`${toastType.toUpperCase()}: ${message}`);
        }
    }

    // Form validation helper
    function validateForm(form) {
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;
        
        requiredFields.forEach(field => {
            const value = field.value.trim();
            if (!value) {
                field.classList.add('is-invalid');
                field.classList.remove('is-valid');
                isValid = false;
            } else {
                field.classList.remove('is-invalid');
                field.classList.add('is-valid');
            }
        });
        
        form.classList.add('was-validated');
        return isValid;
    }
    
    // Add Vehicle Form Submission
    const saveVehicleBtn = document.getElementById('saveVehicleBtn');
    if (saveVehicleBtn) {
        saveVehicleBtn.addEventListener('click', function() {
            const form = document.getElementById('addVehicleForm');
            
            // Validate form
            if (!validateForm(form)) {
                showModalAlert('Veuillez remplir tous les champs obligatoires.', 'danger');
                return;
            }
            
            const formData = new FormData(form);
            const data = {
                plate: formData.get('plate')?.trim() || '',
                brand: formData.get('brand')?.trim() || '',
                model: formData.get('model')?.trim() || '',
                color: formData.get('color')?.trim() || '',
                year: formData.get('year') || null,
                is_stolen: formData.get('is_stolen') === 'on'
            };

            // Disable button
            saveVehicleBtn.disabled = true;
            const originalContent = saveVehicleBtn.innerHTML;
            saveVehicleBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Enregistrement...';

            // Send request
            fetch('/vehicules/add/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    showAlert('Véhicule ajouté avec succès!', 'success');
                    // Hide modal and add vehicle to the page dynamically
                    addVehicleModal.hide();
                    addVehicleToPage(result.vehicle);
                    updateVehicleStats();
                } else {
                    showModalAlert(result.error || 'Erreur lors de l\'ajout du véhicule.', 'danger');
                    saveVehicleBtn.disabled = false;
                    saveVehicleBtn.innerHTML = originalContent;
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showModalAlert('Erreur de connexion. Veuillez réessayer.', 'danger');
                saveVehicleBtn.disabled = false;
                saveVehicleBtn.innerHTML = originalContent;
            });
        });
    }

    // Toggle Stolen Status - Event Delegation
    document.addEventListener('click', function(e) {
        // Check if clicked element or its parent is a toggle stolen button
        let toggleBtn = null;
        if (e.target.classList.contains('toggle-stolen-btn')) {
            toggleBtn = e.target;
        } else if (e.target.parentElement && e.target.parentElement.classList.contains('toggle-stolen-btn')) {
            toggleBtn = e.target.parentElement;
        }
        
        if (toggleBtn) {
            e.preventDefault();
            const vehicleId = toggleBtn.getAttribute('data-vehicle-id');
            
            if (!vehicleId) {
                showAlert('Erreur: ID du véhicule non trouvé.', 'danger');
                return;
            }
            
            // Disable button during request
            toggleBtn.disabled = true;
            const originalText = toggleBtn.innerHTML;
            toggleBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Traitement...';
            
            fetch(`/vehicules/toggle-stolen/${vehicleId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    const message = result.is_stolen ? 'Véhicule déclaré comme volé.' : 'Véhicule marqué comme retrouvé.';
                    showAlert(message, 'success');
                    
                    // Update the card appearance
                    const vehicleCard = document.querySelector(`[data-vehicle-id="${vehicleId}"]`);
                    if (vehicleCard) {
                        const card = vehicleCard.querySelector('.card');
                        const cardHeader = vehicleCard.querySelector('.card-header');
                        
                        if (result.is_stolen) {
                            // Add stolen styling
                            card.classList.add('border-danger');
                            
                            // Add header if not exists
                            if (!cardHeader) {
                                const newHeader = document.createElement('div');
                                newHeader.className = 'card-header bg-danger text-white';
                                newHeader.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>VÉHICULE VOLÉ';
                                card.insertBefore(newHeader, card.firstChild);
                            }
                            
                            // Update button text
                            toggleBtn.innerHTML = '<i class="fas fa-check me-2"></i>Marquer comme retrouvé';
                        } else {
                            // Remove stolen styling
                            card.classList.remove('border-danger');
                            
                            // Remove header
                            if (cardHeader) {
                                cardHeader.remove();
                            }
                            
                            // Update button text
                            toggleBtn.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>Déclarer comme volé';
                        }
                    }
                } else {
                    showAlert(result.error || 'Erreur lors de la mise à jour.', 'danger');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert('Erreur de connexion. Veuillez réessayer.', 'danger');
            })
            .finally(() => {
                toggleBtn.disabled = false;
                if (toggleBtn.innerHTML.includes('Traitement...')) {
                    toggleBtn.innerHTML = originalText;
                }
            });
        }
    });

    // Delete Vehicle - Event Delegation with Modal Confirmation
    let vehicleToDelete = null;
    
    document.addEventListener('click', function(e) {
        let deleteBtn = null;
        if (e.target.classList.contains('delete-vehicle-btn')) {
            deleteBtn = e.target;
        } else if (e.target.parentElement && e.target.parentElement.classList.contains('delete-vehicle-btn')) {
            deleteBtn = e.target.parentElement;
        }
        
        if (deleteBtn) {
            e.preventDefault();
            const vehicleId = deleteBtn.getAttribute('data-vehicle-id');
            
            if (!vehicleId) {
                showAlert('Erreur: ID du véhicule non trouvé.', 'danger');
                return;
            }
            
            // Find vehicle info for confirmation
            const vehicleCard = document.querySelector(`[data-vehicle-id="${vehicleId}"]`);
            const plateName = vehicleCard ? vehicleCard.querySelector('.card-title').textContent.trim() : 'ce véhicule';
            
            // Set up confirmation modal
            vehicleToDelete = vehicleId;
            const confirmModalBody = document.getElementById('confirmModalBody');
            confirmModalBody.innerHTML = `
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                    <h5>Supprimer le véhicule</h5>
                    <p>Êtes-vous sûr de vouloir supprimer le véhicule <strong>${plateName}</strong> ?</p>
                    <p class="text-muted"><small>Cette action est irréversible.</small></p>
                </div>
            `;
            
            confirmModal.show();
        }
    });
    
    // Confirm delete action
    const confirmActionBtn = document.getElementById('confirmActionBtn');
    if (confirmActionBtn) {
        confirmActionBtn.addEventListener('click', function() {
            if (!vehicleToDelete) return;
            
            const originalContent = confirmActionBtn.innerHTML;
            confirmActionBtn.disabled = true;
            confirmActionBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Suppression...';
            
            fetch(`/vehicules/delete/${vehicleToDelete}/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': getCSRFToken()
                }
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    confirmModal.hide();
                    showAlert('Véhicule supprimé avec succès.', 'success');
                    // Remove vehicle from page dynamically
                    removeVehicleFromPage(vehicleToDelete);
                    updateVehicleStats();
                } else {
                    showAlert(result.error || 'Erreur lors de la suppression.', 'danger');
                    confirmModal.hide();
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert('Erreur de connexion. Veuillez réessayer.', 'danger');
                confirmModal.hide();
            })
            .finally(() => {
                confirmActionBtn.disabled = false;
                confirmActionBtn.innerHTML = originalContent;
                vehicleToDelete = null;
            });
        });
    }
    
    // Reset vehicle to delete when modal is hidden
    document.getElementById('confirmModal').addEventListener('hidden.bs.modal', function() {
        vehicleToDelete = null;
        const confirmActionBtn = document.getElementById('confirmActionBtn');
        if (confirmActionBtn) {
            confirmActionBtn.disabled = false;
            confirmActionBtn.innerHTML = 'Confirmer';
        }
    });
    
    // Function to add vehicle to page dynamically
    function addVehicleToPage(vehicle) {
        const vehicleContainer = document.getElementById('vehicleContainer');
        const noVehiclesMessage = document.getElementById('noVehiclesMessage');
        
        // Remove "no vehicles" message if it exists
        if (noVehiclesMessage) {
            noVehiclesMessage.remove();
        }
        
        // Create vehicle card HTML
        const vehicleCard = document.createElement('div');
        vehicleCard.className = 'col-md-6 col-lg-4 mb-4 vehicle-card';
        vehicleCard.setAttribute('data-vehicle-id', vehicle.id);
        vehicleCard.setAttribute('data-is-stolen', vehicle.is_stolen ? 'true' : 'false');
        
        const stolenHeader = vehicle.is_stolen ? `
            <div class="card-header bg-danger text-white">
                <i class="fas fa-exclamation-triangle me-2"></i>VÉHICULE VOLÉ
            </div>
        ` : '';
        
        const borderClass = vehicle.is_stolen ? 'border-danger border-2' : '';
        
        vehicleCard.innerHTML = `
            <div class="card shadow-sm border-0 h-100 ${borderClass}">
                ${stolenHeader}
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div>
                            <h5 class="card-title fw-bold text-dark mb-1">${vehicle.plate}</h5>
                            <span class="badge bg-secondary">${vehicle.brand}</span>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" id="dropdownMenuButton${vehicle.id}" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="fas fa-cog"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="dropdownMenuButton${vehicle.id}">
                                <li>
                                    <button class="dropdown-item toggle-stolen-btn" data-vehicle-id="${vehicle.id}" data-current-status="${vehicle.is_stolen ? 'true' : 'false'}">
                                        ${vehicle.is_stolen ? 
                                            '<i class="fas fa-check text-success me-2"></i>Marquer comme retrouvé' : 
                                            '<i class="fas fa-exclamation-triangle text-warning me-2"></i>Déclarer comme volé'
                                        }
                                    </button>
                                </li>
                                <li><hr class="dropdown-divider"></li>
                                <li>
                                    <button class="dropdown-item text-danger delete-vehicle-btn" data-vehicle-id="${vehicle.id}">
                                        <i class="fas fa-trash me-2"></i>Supprimer
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="vehicle-info">
                        <div class="row g-2">
                            <div class="col-12">
                                <p class="mb-2">
                                    <i class="fas fa-car me-2" style="color: #2c3e50;"></i>
                                    <strong>${vehicle.model}</strong>
                                </p>
                            </div>
                            <div class="col-6">
                                <p class="mb-2">
                                    <i class="fas fa-palette me-2" style="color: #2c3e50;"></i>
                                    <small>${vehicle.color}</small>
                                </p>
                            </div>
                            ${vehicle.year ? `
                            <div class="col-6">
                                <p class="mb-2">
                                    <i class="fas fa-calendar me-2" style="color: #2c3e50;"></i>
                                    <small>${vehicle.year}</small>
                                </p>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="card-footer bg-light text-muted">
                    <div class="d-flex justify-content-between align-items-center">
                        <small>
                            <i class="fas fa-plus-circle me-1"></i>
                            Aujourd'hui
                        </small>
                        <small class="vehicle-status">
                            ${vehicle.is_stolen ? 
                                '<span class="text-danger"><i class="fas fa-exclamation-triangle me-1"></i>Volé</span>' : 
                                '<span class="text-success"><i class="fas fa-shield-alt me-1"></i>Sécurisé</span>'
                            }
                        </small>
                    </div>
                </div>
            </div>
        `;
        
        vehicleContainer.appendChild(vehicleCard);
        
        // Add manual click handler for the new dropdown
        setTimeout(() => {
            const dropdownBtn = vehicleCard.querySelector('[data-bs-toggle="dropdown"]');
            if (dropdownBtn) {
                dropdownBtn.addEventListener('click', function(e) {
                    console.log('New vehicle dropdown clicked');
                    e.preventDefault();
                    
                    // Find the dropdown menu
                    const menu = this.nextElementSibling;
                    if (menu && menu.classList.contains('dropdown-menu')) {
                        // Close other open dropdowns
                        const openMenus = document.querySelectorAll('.dropdown-menu.show');
                        openMenus.forEach(openMenu => {
                            if (openMenu !== menu) {
                                openMenu.classList.remove('show');
                                const openButton = openMenu.previousElementSibling;
                                if (openButton) {
                                    openButton.setAttribute('aria-expanded', 'false');
                                }
                            }
                        });
                        
                        // Toggle this dropdown
                        menu.classList.toggle('show');
                        this.setAttribute('aria-expanded', menu.classList.contains('show'));
                    }
                });
            }
        }, 100);
    }
    
    // Function to remove vehicle from page
    function removeVehicleFromPage(vehicleId) {
        const vehicleCard = document.querySelector(`[data-vehicle-id="${vehicleId}"]`);
        if (vehicleCard) {
            vehicleCard.remove();
        }
        
        // Check if no vehicles left and show message
        const remainingVehicles = document.querySelectorAll('.vehicle-card');
        if (remainingVehicles.length === 0) {
            const vehicleContainer = document.getElementById('vehicleContainer');
            vehicleContainer.innerHTML = `
                <div class="col-12" id="noVehiclesMessage">
                    <div class="text-center py-5">
                        <div class="mb-4">
                            <i class="fas fa-car fa-5x text-muted opacity-50"></i>
                        </div>
                        <h3 class="text-muted mb-3">Aucun véhicule enregistré</h3>
                        <p class="text-muted mb-4">Commencez par ajouter votre premier véhicule pour commencer à gérer votre parc automobile.</p>
                        <button type="button" class="btn btn-lg btn-primary" id="addFirstVehicleBtn" style="background-color: #2c3e50; border-color: #2c3e50;">
                            <i class="fas fa-plus me-2"></i>Ajouter mon premier véhicule
                        </button>
                    </div>
                </div>
            `;
        }
    }
    
    // Function to update vehicle statistics
    function updateVehicleStats() {
        const vehicleCards = document.querySelectorAll('.vehicle-card');
        const totalCount = vehicleCards.length;
        let stolenCount = 0;
        
        vehicleCards.forEach(card => {
            if (card.getAttribute('data-is-stolen') === 'true') {
                stolenCount++;
            }
        });
        
        const safeCount = totalCount - stolenCount;
        
        // Update counters
        const vehicleCountEl = document.getElementById('vehicleCount');
        const safeVehicleCountEl = document.getElementById('safeVehicleCount');
        const stolenVehicleCountEl = document.getElementById('stolenVehicleCount');
        
        if (vehicleCountEl) vehicleCountEl.textContent = totalCount;
        if (safeVehicleCountEl) safeVehicleCountEl.textContent = safeCount;
        if (stolenVehicleCountEl) stolenVehicleCountEl.textContent = stolenCount;
    }

    // Clean up modal alerts when modal is hidden
    document.getElementById('addVehicleModal').addEventListener('hidden.bs.modal', function() {
        const modalAlertContainer = document.getElementById('modalAlertContainer');
        if (modalAlertContainer) {
            modalAlertContainer.innerHTML = '';
        }
        
        // Reset save button
        const saveBtn = document.getElementById('saveVehicleBtn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Enregistrer le véhicule';
        }
    });
});
