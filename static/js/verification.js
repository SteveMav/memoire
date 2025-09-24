// Version 1.0 - Système de vérification des véhicules et propriétaires
console.log('Verification JS v1.0 loaded');

// Délégation d'événements globale pour le bouton de vérification
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'verifyPlatesBtn') {
        console.log('Clic sur verifyPlatesBtn capturé par délégation globale (verification.js)');
        e.preventDefault();
        e.stopPropagation();
        verifyVehicles();
    }
});

// Fonction principale pour vérifier les véhicules
function verifyVehicles() {
    console.log('Fonction verifyVehicles appelée');
    
    const inputs = document.querySelectorAll('.plate-text-input');
    console.log('Inputs trouvés pour vérification:', inputs.length);
    
    if (inputs.length === 0) {
        if (window.showWarning) {
            window.showWarning('Aucune plaque à vérifier');
        } else {
            alert('Aucune plaque à vérifier');
        }
        return;
    }
    
    const plates = Array.from(inputs).map(input => ({
        plate_id: input.dataset.plateId,
        corrected_text: input.value.trim()
    }));
    
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
        console.log('Réponse vérification reçue:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Données vérification reçues:', data);
        if (data.success) {
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
    console.log('Test du bouton de vérification...');
    const verifyBtn = document.getElementById('verifyPlatesBtn');
    if (verifyBtn) {
        console.log('Bouton vérifier trouvé !');
        console.log('- ID:', verifyBtn.id);
        console.log('- Classes:', verifyBtn.className);
        console.log('- Disabled:', verifyBtn.disabled);
        console.log('Simulation du clic...');
        
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        verifyBtn.dispatchEvent(clickEvent);
    } else {
        console.log('❌ Bouton vérifier non trouvé');
    }
};

// Fonction de test pour sauvegarde directe avec vérification
window.testDirectVerify = function() {
    console.log('Test de vérification directe...');
    
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
    
    console.log('Envoi de données de test pour vérification:', testData);
    
    fetch('/detection/save-corrected-plates/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify(testData)
    })
    .then(response => {
        console.log('Réponse test vérification:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Données test vérification reçues:', data);
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
    });
};

console.log('Verification JS loaded at:', new Date().toISOString());
