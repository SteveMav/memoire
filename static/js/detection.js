document.addEventListener('DOMContentLoaded', function() {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('imageInput');
    const preview = document.getElementById('preview');
    const uploadForm = document.getElementById('uploadForm');
    const resultsSection = document.getElementById('resultsSection');

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
        dropArea.classList.add('dragover');
    }

    function unhighlight() {
        dropArea.classList.remove('dragover');
    }

    // Gestion du dépôt de fichier
    dropArea.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFiles);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files } });
    }

    function handleFiles(e) {
        const files = e.target.files;
        if (files.length) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                displayPreview(file);
            } else {
                alert('Veuillez sélectionner un fichier image valide (JPG, JPEG, PNG)');
            }
        }
    }

    // Affichage de l'aperçu de l'image
    function displayPreview(file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = 'Aperçu de l\'image';
            img.className = 'img-fluid';
            
            preview.innerHTML = '';
            preview.appendChild(img);
            
            // Afficher la section des résultats si elle était masquée
            resultsSection.style.display = 'none';
        };
        
        reader.readAsDataURL(file);
    }

    // Soumission du formulaire
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!fileInput.files.length) {
            alert('Veuillez sélectionner une image à analyser');
            return;
        }
        
        const formData = new FormData(uploadForm);
        
        // Afficher un indicateur de chargement
        const submitBtn = uploadForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Traitement en cours...';
        
        // Envoyer la requête AJAX
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
            if (data.success) {
                displayResults(data);
            } else {
                throw new Error(data.error || 'Une erreur est survenue lors de la détection');
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            alert(error.message || 'Une erreur est survenue lors du traitement de l\'image');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        });
    });
    
    // Affichage des résultats
    function displayResults(data) {
        const resultsDiv = document.getElementById('detectionResults');
        resultsDiv.innerHTML = '';
        
        // Afficher l'image avec les détections
        if (data.image_with_boxes) {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'text-center mb-4';
            
            const img = document.createElement('img');
            img.src = 'data:image/jpeg;base64,' + data.image_with_boxes;
            img.alt = 'Résultats de la détection';
            img.className = 'img-fluid rounded shadow';
            
            imgContainer.appendChild(img);
            resultsDiv.appendChild(imgContainer);
        }
        
        // Afficher les statistiques
        if (data.detections && data.detections.length > 0) {
            const statsDiv = document.createElement('div');
            statsDiv.className = 'mt-4';
            
            const statsTitle = document.createElement('h5');
            statsTitle.className = 'mb-3';
            statsTitle.textContent = 'Résumé des détections';
            
            const statsList = document.createElement('ul');
            statsList.className = 'list-group';
            
            // Compter les occurrences de chaque classe détectée
            const classCounts = {};
            data.detections.forEach(detection => {
                const className = detection.class;
                classCounts[className] = (classCounts[className] || 0) + 1;
            });
            
            // Afficher le décompte pour chaque classe
            Object.entries(classCounts).forEach(([className, count]) => {
                const item = document.createElement('li');
                item.className = 'list-group-item d-flex justify-content-between align-items-center';
                item.innerHTML = `
                    ${className}
                    <span class="badge bg-primary rounded-pill">${count}</span>
                `;
                statsList.appendChild(item);
            });
            
            statsDiv.appendChild(statsTitle);
            statsDiv.appendChild(statsList);
            resultsDiv.appendChild(statsDiv);
        } else {
            const noResults = document.createElement('div');
            noResults.className = 'alert alert-info';
            noResults.textContent = 'Aucun objet détecté dans cette image.';
            resultsDiv.appendChild(noResults);
        }
        
        // Afficher la section des résultats
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
});
