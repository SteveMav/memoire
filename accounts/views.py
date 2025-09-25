from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.contrib.auth.decorators import login_required, permission_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.core.paginator import Paginator
from django.db.models import Q
from django.urls import reverse
from .forms import LoginForm, RegisterForm, PasswordResetRequestForm, PasswordResetCodeForm, NewPasswordForm
from .models import PasswordResetCode
from .email_utils import send_password_reset_email, send_password_changed_notification
from detection.models import Detection
from vehicules.models import Vehicle

def login_view(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            password = form.cleaned_data['password']
            
            # Authentifier avec l'email (le backend personnalisé gère la conversion)
            user = authenticate(request, username=email, password=password)
            
            if user is not None:
                login(request, user)
                messages.success(request, f'Bienvenue {user.first_name or user.username}!')
                return redirect('home')
            else:
                messages.error(request, 'Adresse email ou mot de passe incorrect.')
    else:
        form = LoginForm()
    
    return render(request, 'accounts/login.html', {'form': form})

def register_view(request):
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            try:
                user = form.save()
                messages.success(request, 'Compte créé avec succès! Vous pouvez maintenant vous connecter.')
                login(request, user)
                return redirect('home')
            except Exception as e:
                messages.error(request, f'Erreur lors de la création du compte: {str(e)}')
        else:
            messages.error(request, 'Veuillez corriger les erreurs ci-dessous.')
            # Debug: print form errors
            print("Form errors:", form.errors)
    else:
        form = RegisterForm()
    
    return render(request, 'accounts/register.html', {'form': form})

def logout_view(request):
    logout(request)
    messages.success(request, 'Vous avez été déconnecté avec succès.')
    return redirect('home')

@permission_required('detection.add_detection', raise_exception=True)
@login_required
def agent_space(request):
    """Vue pour l'espace agent - affiche toutes les détections effectuées par l'agent ou toutes les détections pour les superadmin"""
    # Vérifier les permissions : agent ou membre du staff
    is_agent = hasattr(request.user, 'profile') and request.user.profile.is_agent()
    is_staff = request.user.is_staff
    
    if not is_agent and not is_staff:
        messages.error(request, 'Accès refusé. Vous devez être un agent ou un administrateur pour accéder à cette page.')
        return redirect('home')
    
    # Récupérer les détections selon le type d'utilisateur
    if is_staff and not is_agent:
        # Superadmin : voir toutes les détections
        detections = Detection.objects.all().select_related('found_vehicle', 'found_vehicle__owner', 'user', 'user__profile').order_by('-detection_date')
        agent_number = 'ADMIN'
        user_type = 'Administrateur'
    else:
        # Agent : voir ses propres détections
        detections = Detection.objects.filter(user=request.user).select_related('found_vehicle', 'found_vehicle__owner').order_by('-detection_date')
        agent_number = request.user.profile.agent_number if hasattr(request.user, 'profile') else 'N/A'
        user_type = 'Agent'
    
    # Pagination
    paginator = Paginator(detections, 10)  # 10 détections par page
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'detections': page_obj,
        'total_detections': detections.count(),
        'agent_number': agent_number,
        'user_type': user_type,
        'is_staff': is_staff,
        'is_agent': is_agent,
    }
    
    return render(request, 'accounts/agent_space.html', context)


@permission_required('detection.add_detection', raise_exception=True)
@login_required
def search_plate(request):
    """Vue AJAX pour rechercher une plaque d'immatriculation"""
    # Vérifier les permissions : agent ou membre du staff
    is_agent = hasattr(request.user, 'profile') and request.user.profile.is_agent()
    is_staff = request.user.is_staff
    
    if not is_agent and not is_staff:
        return JsonResponse({'error': 'Accès refusé'}, status=403)
    
    if request.method == 'GET':
        plate_number = request.GET.get('plate', '').strip().upper()
        
        if not plate_number:
            return JsonResponse({'error': 'Numéro de plaque requis'}, status=400)
        
        try:
            # Rechercher le véhicule
            vehicle = Vehicle.objects.select_related('owner').get(plate=plate_number)
            
            # Récupérer les détections associées à ce véhicule
            detections = Detection.objects.filter(
                Q(detected_plate=plate_number) | Q(found_vehicle=vehicle)
            ).select_related('user', 'user__profile').order_by('-detection_date')[:5]
            
            # Préparer les données de réponse
            vehicle_data = {
                'id': vehicle.id,  # Ajout de l'ID manquant !
                'plate': vehicle.plate,
                'brand': vehicle.brand,
                'model': vehicle.model,
                'color': vehicle.color,
                'year': vehicle.year,
                'is_stolen': vehicle.is_stolen,
                'stolen_date': vehicle.stolen_date.strftime('%d/%m/%Y %H:%M') if vehicle.stolen_date else None,
                'owner': {
                    'first_name': vehicle.owner.first_name,
                    'last_name': vehicle.owner.last_name,
                    'username': vehicle.owner.username,
                    'email': vehicle.owner.email,
                }
            }
            
            detections_data = []
            for detection in detections:
                detections_data.append({
                    'id': detection.id,
                    'detected_plate': detection.detected_plate,
                    'detection_date': detection.detection_date.strftime('%d/%m/%Y %H:%M'),
                    'agent': {
                        'username': detection.user.username if detection.user else 'Système',
                        'agent_number': detection.user.profile.agent_number if detection.user and hasattr(detection.user, 'profile') else None
                    },
                    'has_image': bool(detection.image),
                    'has_video': bool(detection.video)
                })
            
            return JsonResponse({
                'success': True,
                'vehicle': vehicle_data,
                'detections': detections_data,
                'detections_count': detections.count()
            })
            
        except Vehicle.DoesNotExist:
            # Chercher dans les détections même si le véhicule n'est pas enregistré
            detections = Detection.objects.filter(
                detected_plate=plate_number
            ).select_related('user', 'user__profile').order_by('-detection_date')[:5]
            
            if detections.exists():
                detections_data = []
                for detection in detections:
                    detections_data.append({
                        'id': detection.id,
                        'detected_plate': detection.detected_plate,
                        'detection_date': detection.detection_date.strftime('%d/%m/%Y %H:%M'),
                        'agent': {
                            'username': detection.user.username if detection.user else 'Système',
                            'agent_number': detection.user.profile.agent_number if detection.user and hasattr(detection.user, 'profile') else None
                        },
                        'has_image': bool(detection.image),
                        'has_video': bool(detection.video)
                    })
                
                return JsonResponse({
                    'success': True,
                    'vehicle': None,
                    'detections': detections_data,
                    'detections_count': detections.count(),
                    'message': 'Véhicule non enregistré dans la base, mais des détections existent.'
                })
            else:
                return JsonResponse({
                    'success': False,
                    'message': 'Aucun véhicule ou détection trouvé pour cette plaque.'
                })
        
        except Exception as e:
            return JsonResponse({'error': f'Erreur lors de la recherche: {str(e)}'}, status=500)
    
    return JsonResponse({'error': 'Méthode non autorisée'}, status=405)


def password_reset_request(request):
    """Vue pour demander un code de récupération de mot de passe"""
    if request.method == 'POST':
        form = PasswordResetRequestForm(request.POST)
        if form.is_valid():
            user = form.get_user()
            if user:
                # Générer un nouveau code de récupération
                reset_code = PasswordResetCode.generate_code(user)
                
                # Envoyer l'email avec le code
                if send_password_reset_email(user, reset_code):
                    messages.success(
                        request, 
                        f'Un code de récupération a été envoyé à {user.email}. '
                        'Vérifiez votre boîte de réception et vos spams.'
                    )
                    # Rediriger vers la page de validation du code avec l'email en paramètre
                    return redirect(reverse('accounts:password_reset_code') + f'?email={user.email}')
                else:
                    messages.error(
                        request, 
                        'Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.'
                    )
        else:
            messages.error(request, 'Veuillez corriger les erreurs ci-dessous.')
    else:
        form = PasswordResetRequestForm()
    
    return render(request, 'accounts/password_reset_request.html', {'form': form})


def password_reset_code(request):
    """Vue pour valider le code de récupération"""
    email = request.GET.get('email')
    if not email:
        messages.error(request, 'Session expirée. Veuillez recommencer.')
        return redirect('accounts:password_reset_request')
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        messages.error(request, 'Utilisateur introuvable.')
        return redirect('accounts:password_reset_request')
    
    if request.method == 'POST':
        form = PasswordResetCodeForm(user=user, data=request.POST)
        if form.is_valid():
            reset_code = form.get_reset_code()
            if reset_code:
                # Marquer le code comme utilisé
                reset_code.mark_as_used()
                
                # Rediriger vers la page de nouveau mot de passe
                request.session['reset_user_id'] = user.id
                request.session['reset_code_validated'] = True
                
                messages.success(request, 'Code validé avec succès. Définissez votre nouveau mot de passe.')
                return redirect('accounts:password_reset_new')
        else:
            messages.error(request, 'Code invalide ou expiré.')
    else:
        form = PasswordResetCodeForm(user=user)
    
    # Vérifier s'il y a un code valide pour cet utilisateur
    has_valid_code = PasswordResetCode.objects.filter(
        user=user, 
        is_used=False
    ).exists()
    
    context = {
        'form': form,
        'email': email,
        'has_valid_code': has_valid_code
    }
    
    return render(request, 'accounts/password_reset_code.html', context)


def password_reset_new(request):
    """Vue pour définir un nouveau mot de passe"""
    # Vérifier que l'utilisateur a validé son code
    if not request.session.get('reset_code_validated') or not request.session.get('reset_user_id'):
        messages.error(request, 'Session expirée. Veuillez recommencer le processus.')
        return redirect('accounts:password_reset_request')
    
    try:
        user = User.objects.get(id=request.session['reset_user_id'])
    except User.DoesNotExist:
        messages.error(request, 'Utilisateur introuvable.')
        return redirect('accounts:password_reset_request')
    
    if request.method == 'POST':
        form = NewPasswordForm(request.POST)
        if form.is_valid():
            # Changer le mot de passe
            new_password = form.cleaned_data['new_password1']
            user.set_password(new_password)
            user.save()
            
            # Nettoyer la session
            request.session.pop('reset_user_id', None)
            request.session.pop('reset_code_validated', None)
            
            # Envoyer une notification de confirmation
            send_password_changed_notification(user)
            
            messages.success(
                request, 
                'Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter.'
            )
            return redirect('accounts:login')
        else:
            messages.error(request, 'Veuillez corriger les erreurs ci-dessous.')
    else:
        form = NewPasswordForm()
    
    context = {
        'form': form,
        'user': user
    }
    
    return render(request, 'accounts/password_reset_new.html', context)


def resend_reset_code(request):
    """Vue AJAX pour renvoyer un code de récupération"""
    if request.method == 'POST':
        email = request.POST.get('email')
        if not email:
            return JsonResponse({'success': False, 'message': 'Email manquant'})
        
        try:
            user = User.objects.get(email=email)
            
            # Générer un nouveau code
            reset_code = PasswordResetCode.generate_code(user)
            
            # Envoyer l'email
            if send_password_reset_email(user, reset_code):
                return JsonResponse({
                    'success': True, 
                    'message': 'Un nouveau code a été envoyé à votre adresse email.'
                })
            else:
                return JsonResponse({
                    'success': False, 
                    'message': 'Erreur lors de l\'envoi de l\'email.'
                })
                
        except User.DoesNotExist:
            return JsonResponse({
                'success': False, 
                'message': 'Utilisateur introuvable.'
            })
    
    return JsonResponse({'success': False, 'message': 'Méthode non autorisée'})