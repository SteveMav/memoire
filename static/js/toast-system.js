/**
 * Système de toasts JavaScript moderne pour l'application
 * Remplace les messages Django par des notifications stylées
 */

class ToastSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Créer le conteneur de toasts s'il n'existe pas
        this.createContainer();
        
        // Écouter les messages Django au chargement de la page
        this.processDjangoMessages();
        
        // Exposer les méthodes globalement
        window.showToast = this.show.bind(this);
        window.showSuccess = this.success.bind(this);
        window.showError = this.error.bind(this);
        window.showWarning = this.warning.bind(this);
        window.showInfo = this.info.bind(this);
    }

    createContainer() {
        if (this.container) return;
        
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'toast-container';
        this.container.innerHTML = `
            <style>
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    max-width: 400px;
                    pointer-events: none;
                }
                
                .custom-toast {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                    margin-bottom: 12px;
                    padding: 16px 20px;
                    border-left: 4px solid;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    opacity: 0;
                    transform: translateX(100%);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    pointer-events: auto;
                    position: relative;
                    overflow: hidden;
                    max-width: 100%;
                    word-wrap: break-word;
                }
                
                .custom-toast.show {
                    opacity: 1;
                    transform: translateX(0);
                }
                
                .custom-toast.hide {
                    opacity: 0;
                    transform: translateX(100%);
                    margin-bottom: 0;
                    padding-top: 0;
                    padding-bottom: 0;
                }
                
                .custom-toast.success {
                    border-left-color: #10b981;
                    background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
                }
                
                .custom-toast.error {
                    border-left-color: #ef4444;
                    background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%);
                }
                
                .custom-toast.warning {
                    border-left-color: #f59e0b;
                    background: linear-gradient(135deg, #fffbeb 0%, #ffffff 100%);
                }
                
                .custom-toast.info {
                    border-left-color: #3b82f6;
                    background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
                }
                
                .toast-icon {
                    flex-shrink: 0;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    font-weight: bold;
                    color: white;
                }
                
                .toast-icon.success {
                    background: #10b981;
                }
                
                .toast-icon.error {
                    background: #ef4444;
                }
                
                .toast-icon.warning {
                    background: #f59e0b;
                }
                
                .toast-icon.info {
                    background: #3b82f6;
                }
                
                .toast-content {
                    flex: 1;
                    color: #374151;
                    font-size: 14px;
                    line-height: 1.5;
                    font-weight: 500;
                }
                
                .toast-close {
                    flex-shrink: 0;
                    background: none;
                    border: none;
                    color: #9ca3af;
                    cursor: pointer;
                    font-size: 18px;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: all 0.2s ease;
                }
                
                .toast-close:hover {
                    background: #f3f4f6;
                    color: #374151;
                }
                
                .toast-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 0 0 12px 12px;
                    transform-origin: left;
                    animation: toast-progress 5s linear forwards;
                }
                
                .custom-toast.success .toast-progress {
                    background: #10b981;
                }
                
                .custom-toast.error .toast-progress {
                    background: #ef4444;
                }
                
                .custom-toast.warning .toast-progress {
                    background: #f59e0b;
                }
                
                .custom-toast.info .toast-progress {
                    background: #3b82f6;
                }
                
                @keyframes toast-progress {
                    from {
                        transform: scaleX(1);
                    }
                    to {
                        transform: scaleX(0);
                    }
                }
                
                @media (max-width: 640px) {
                    .toast-container {
                        top: 10px;
                        right: 10px;
                        left: 10px;
                        max-width: none;
                    }
                    
                    .custom-toast {
                        margin-bottom: 8px;
                        padding: 12px 16px;
                    }
                }
            </style>
        `;
        
        document.body.appendChild(this.container);
    }

    processDjangoMessages() {
        // Traiter les messages Django existants et les convertir en toasts
        const messageElements = document.querySelectorAll('.alert');
        messageElements.forEach(alert => {
            const message = alert.textContent.trim();
            let type = 'info';
            
            if (alert.classList.contains('alert-success')) {
                type = 'success';
            } else if (alert.classList.contains('alert-danger') || alert.classList.contains('alert-error')) {
                type = 'error';
            } else if (alert.classList.contains('alert-warning')) {
                type = 'warning';
            }
            
            // Afficher le toast
            this.show(message, type);
            
            // Masquer l'alerte Django originale
            alert.style.display = 'none';
        });
    }

    show(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `custom-toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        toast.innerHTML = `
            <div class="toast-icon ${type}">${icons[type]}</div>
            <div class="toast-content">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
            <div class="toast-progress"></div>
        `;
        
        this.container.appendChild(toast);
        
        // Animation d'entrée
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Auto-suppression
        if (duration > 0) {
            setTimeout(() => {
                this.hide(toast);
            }, duration);
        }
        
        return toast;
    }

    hide(toast) {
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }

    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 7000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 6000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }
}

// Initialiser le système de toasts quand le DOM est prêt
document.addEventListener('DOMContentLoaded', function() {
    new ToastSystem();
});

// Fonction utilitaire pour les requêtes AJAX
window.handleAjaxResponse = function(response, successCallback) {
    if (response.success) {
        if (response.message) {
            showSuccess(response.message);
        }
        if (successCallback) {
            successCallback(response);
        }
    } else {
        showError(response.message || 'Une erreur est survenue');
    }
};

// Intercepter les soumissions de formulaires pour afficher des toasts
document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.classList.contains('toast-form')) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const url = form.action || window.location.href;
        
        fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            }
        })
        .then(response => response.json())
        .then(data => {
            handleAjaxResponse(data, () => {
                if (data.redirect) {
                    window.location.href = data.redirect;
                }
            });
        })
        .catch(error => {
            showError('Une erreur est survenue lors de l\'envoi du formulaire');
            console.error('Form submission error:', error);
        });
    }
});
