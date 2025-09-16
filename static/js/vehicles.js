// Vehicle Management JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const addVehicleForm = document.getElementById('addVehicleForm');
    const saveVehicleBtn = document.getElementById('saveVehicleBtn');
    const addVehicleModal = new bootstrap.Modal(document.getElementById('addVehicleModal'));
    const vehicleContainer = document.getElementById('vehicleContainer');
    const noVehiclesMessage = document.getElementById('noVehiclesMessage');

    // Add Vehicle Form Submission
    saveVehicleBtn.addEventListener('click', function() {
        const formData = new FormData(addVehicleForm);
        const data = {
            plate: formData.get('plate').trim(),
            brand: formData.get('brand').trim(),
            model: formData.get('model').trim(),
            color: formData.get('color').trim(),
            year: formData.get('year') || null
        };

        // Basic validation
        if (!data.plate || !data.brand || !data.model || !data.color) {
            showAlert('Veuillez remplir tous les champs obligatoires.', 'danger');
            return;
        }

        // Disable button during request
        saveVehicleBtn.disabled = true;
        saveVehicleBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Enregistrement...';

        // Send AJAX request
        fetch('/vehicules/add/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Add vehicle card to the page
                addVehicleCard(data.vehicle);
                
                // Hide no vehicles message if it exists
                if (noVehiclesMessage) {
                    noVehiclesMessage.style.display = 'none';
                }
                
                // Reset form and close modal
                addVehicleForm.reset();
                addVehicleModal.hide();
                
                showAlert('Véhicule ajouté avec succès!', 'success');
            } else {
                showAlert(data.error || 'Erreur lors de l\'ajout du véhicule.', 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Erreur de connexion. Veuillez réessayer.', 'danger');
        })
        .finally(() => {
            // Re-enable button
            saveVehicleBtn.disabled = false;
            saveVehicleBtn.innerHTML = '<i class="fas fa-save me-2"></i>Enregistrer';
        });
    });

    // Toggle Stolen Status
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('toggle-stolen-btn') || e.target.parentElement.classList.contains('toggle-stolen-btn')) {
            const btn = e.target.classList.contains('toggle-stolen-btn') ? e.target : e.target.parentElement;
            const vehicleId = btn.getAttribute('data-vehicle-id');
            
            fetch(`/vehicules/toggle-stolen/${vehicleId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    updateVehicleCard(vehicleId, data);
                    const message = data.is_stolen ? 'Véhicule déclaré comme volé.' : 'Véhicule marqué comme retrouvé.';
                    showAlert(message, 'success');
                } else {
                    showAlert(data.error || 'Erreur lors de la mise à jour.', 'danger');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert('Erreur de connexion. Veuillez réessayer.', 'danger');
            });
        }
    });

    // Delete Vehicle
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('delete-vehicle-btn') || e.target.parentElement.classList.contains('delete-vehicle-btn')) {
            const btn = e.target.classList.contains('delete-vehicle-btn') ? e.target : e.target.parentElement;
            const vehicleId = btn.getAttribute('data-vehicle-id');
            
            if (confirm('Êtes-vous sûr de vouloir supprimer ce véhicule ?')) {
                fetch(`/vehicules/delete/${vehicleId}/`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken')
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Remove vehicle card
                        const vehicleCard = document.querySelector(`[data-vehicle-id="${vehicleId}"]`);
                        if (vehicleCard) {
                            vehicleCard.remove();
                        }
                        
                        // Show no vehicles message if no vehicles left
                        const remainingVehicles = document.querySelectorAll('[data-vehicle-id]');
                        if (remainingVehicles.length === 0 && noVehiclesMessage) {
                            noVehiclesMessage.style.display = 'block';
                        }
                        
                        showAlert('Véhicule supprimé avec succès.', 'success');
                    } else {
                        showAlert(data.error || 'Erreur lors de la suppression.', 'danger');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showAlert('Erreur de connexion. Veuillez réessayer.', 'danger');
                });
            }
        }
    });

    // Helper Functions
    function addVehicleCard(vehicle) {
        const cardHtml = `
            <div class="col-md-6 col-lg-4 mb-4" data-vehicle-id="${vehicle.id}">
                <div class="card shadow-sm border-0 h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <h5 class="card-title fw-bold text-dark">${vehicle.plate}</h5>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <ul class="dropdown-menu">
                                    <li>
                                        <button class="dropdown-item toggle-stolen-btn" data-vehicle-id="${vehicle.id}">
                                            <i class="fas fa-exclamation-triangle me-2"></i>Déclarer comme volé
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
                            <p class="mb-2">
                                <i class="fas fa-industry me-2" style="color: #2c3e50;"></i>
                                <strong>${vehicle.brand} ${vehicle.model}</strong>
                            </p>
                            <p class="mb-2">
                                <i class="fas fa-palette me-2" style="color: #2c3e50;"></i>
                                ${vehicle.color}
                            </p>
                            ${vehicle.year ? `<p class="mb-2">
                                <i class="fas fa-calendar me-2" style="color: #2c3e50;"></i>
                                ${vehicle.year}
                            </p>` : ''}
                        </div>
                    </div>
                    <div class="card-footer bg-light text-muted">
                        <small>
                            <i class="fas fa-plus-circle me-1"></i>
                            Ajouté le ${vehicle.created_at}
                        </small>
                    </div>
                </div>
            </div>
        `;
        
        vehicleContainer.insertAdjacentHTML('beforeend', cardHtml);
    }

    function updateVehicleCard(vehicleId, data) {
        const vehicleCard = document.querySelector(`[data-vehicle-id="${vehicleId}"]`);
        if (!vehicleCard) return;

        const card = vehicleCard.querySelector('.card');
        const toggleBtn = vehicleCard.querySelector('.toggle-stolen-btn');
        
        if (data.is_stolen) {
            // Add stolen styling
            card.classList.add('border-danger');
            
            // Add stolen header if not exists
            if (!vehicleCard.querySelector('.card-header')) {
                const cardHeader = document.createElement('div');
                cardHeader.className = 'card-header bg-danger text-white';
                cardHeader.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>VÉHICULE VOLÉ';
                card.insertBefore(cardHeader, card.firstChild);
            }
            
            // Update button
            toggleBtn.innerHTML = '<i class="fas fa-check me-2"></i>Marquer comme retrouvé';
            
            // Add stolen date info
            if (data.stolen_date) {
                const vehicleInfo = vehicleCard.querySelector('.vehicle-info');
                const stolenInfo = document.createElement('p');
                stolenInfo.className = 'mb-2 text-danger stolen-date-info';
                stolenInfo.innerHTML = `<i class="fas fa-clock me-2"></i>Volé le ${data.stolen_date}`;
                vehicleInfo.appendChild(stolenInfo);
            }
        } else {
            // Remove stolen styling
            card.classList.remove('border-danger');
            
            // Remove stolen header
            const cardHeader = vehicleCard.querySelector('.card-header');
            if (cardHeader) {
                cardHeader.remove();
            }
            
            // Update button
            toggleBtn.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>Déclarer comme volé';
            
            // Remove stolen date info
            const stolenDateInfo = vehicleCard.querySelector('.stolen-date-info');
            if (stolenDateInfo) {
                stolenDateInfo.remove();
            }
        }
    }

    function showAlert(message, type) {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Insert at the top of main content
        const main = document.querySelector('main');
        main.insertAdjacentHTML('afterbegin', alertHtml);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            const alert = main.querySelector('.alert');
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});
