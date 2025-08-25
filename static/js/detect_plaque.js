document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('mediaInput');
    const preview = document.getElementById('preview');
    const resultsSection = document.getElementById('resultsSection');
    const detectionResults = document.getElementById('detectionResults');
    const loadingIndicator = document.createElement('div');
    
    // Configurer l'indicateur de chargement
    loadingIndicator.className = 'text-center my-5';
    loadingIndicator.innerHTML = `
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Chargement...</span>
        </div>
        <p class="mt-2">Analyse en cours, veuillez patienter...</p>
    `;
    
    // Gestion du glisser-déposer
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('border-primary');
    }
    
    function unhighlight() {
        dropArea.classList.remove('border-primary');
    }
    
    // Gérer le dépôt de fichiers
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    
    // Gérer la sélection de fichiers via le bouton
    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });
    
    function handleFiles(files) {
        if (files.length > 0) {
            fileInput.files = files;
            updatePreview(files[0]);
        }
    }
    
    // Afficher l'aperçu du fichier sélectionné
    function updatePreview(file) {
        preview.innerHTML = '';
        
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'img-fluid rounded mt-3';
                img.style.maxHeight = '200px';
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    }
    
    // Soumission du formulaire
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(uploadForm);
            
            // Afficher l'indicateur de chargement
            detectionResults.innerHTML = '';
            detectionResults.appendChild(loadingIndicator);
            resultsSection.style.display = 'block';
            
            // Faire défiler jusqu'aux résultats
            resultsSection.scrollIntoView({ behavior: 'smooth' });
            
            // Envoyer la requête AJAX
            fetch(uploadForm.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                displayResults(data);
            })
            .catch(error => {
                console.error('Erreur:', error);
                detectionResults.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        ${error.message || 'Une erreur est survenue lors du traitement de l\'image.'}
                    </div>
                `;
            });
        });
    }
    
    // Afficher les résultats de la détection
    function displayResults(data) {
        let html = `
            <div class="row mb-5">
                <div class="col-md-6 mb-4 mb-md-0">
                    <div class="card h-100">
                        <div class="card-header bg-light">
                            <h5 class="mb-0">Image originale</h5>
                        </div>
                        <div class="card-body text-center">
                            <img src="/${data.original_image}" class="img-fluid rounded" alt="Image originale">
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card h-100">
                        <div class="card-header bg-light">
                            <h5 class="mb-0">Résultat de la détection</h5>
                        </div>
                        <div class="card-body text-center">
                            <img src="/${data.processed_image}" class="img-fluid rounded" alt="Résultat de la détection">
                            <p class="mt-3 mb-0">
                                <span class="badge bg-primary">${data.cars_detected} ${data.cars_detected > 1 ? 'véhicules détectés' : 'véhicule détecté'}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Afficher les plaques détectées
        if (data.plates && data.plates.length > 0) {
            html += `
                <div class="mt-5">
                    <h3 class="h4 mb-4 text-center">Plaques d'immatriculation détectées</h3>
                    <div class="row">
            `;
            
            data.plates.forEach((plate, index) => {
                html += `
                    <div class="col-md-4 mb-4">
                        <div class="card h-100">
                            <div class="card-header bg-light">
                                <h6 class="mb-0">Plaque #${index + 1}</h6>
                            </div>
                            <div class="card-body text-center">
                                <img src="/${plate.plate_image}" class="img-fluid mb-3" alt="Plaque détectée" style="max-height: 150px;">
                                <div class="p-3 bg-light rounded">
                                    <strong>Texte extrait :</strong>
                                    <p class="mb-0 font-monospace">${plate.plate_text}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="alert alert-info text-center">
                    <i class="fas fa-info-circle me-2"></i>
                    Aucune plaque d'immatriculation n'a été détectée sur cette image.
                </div>
            `;
        }
        
        // Ajouter un bouton pour une nouvelle analyse
        html += `
            <div class="text-center mt-4">
                <button onclick="window.location.reload()" class="btn btn-primary">
                    <i class="fas fa-redo me-2"></i>Nouvelle analyse
                </button>
            </div>
        `;
        
        detectionResults.innerHTML = html;
    }
});
