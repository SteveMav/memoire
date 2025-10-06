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
from .models import PasswordResetCode, AgentCode
from .email_utils import send_password_reset_email, send_password_changed_notification
from detection.models import Detection, Amende, Infraction
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
                # Spécifier explicitement le backend d'authentification
                login(request, user, backend='accounts.backends.EmailBackend')
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


@login_required
def search_amende(request):
    """Vue AJAX pour rechercher une amende par numéro"""
    if not request.user.profile.is_agent and not request.user.is_staff:
        return JsonResponse({
            'success': False,
            'message': 'Accès non autorisé'
        })
    
    numero_amende = request.GET.get('numero', '').strip()
    
    if not numero_amende:
        return JsonResponse({
            'success': False,
            'message': 'Numéro d\'amende requis'
        })
    
    try:
        # Rechercher l'amende
        amende = Amende.objects.select_related(
            'vehicle', 'vehicle__owner', 'infraction', 'agent'
        ).get(numero_amende__iexact=numero_amende)
        
        # Préparer les données de réponse
        amende_data = {
            'id': amende.id,
            'numero_amende': amende.numero_amende,
            'montant': float(amende.montant),
            'statut': amende.statut,
            'statut_display': amende.get_statut_display(),
            'date_emission': amende.date_emission.strftime('%d/%m/%Y à %H:%M'),
            'date_limite_paiement': amende.date_limite_paiement.strftime('%d/%m/%Y'),
            'date_paiement': amende.date_paiement.strftime('%d/%m/%Y à %H:%M') if amende.date_paiement else None,
            'lieu_infraction': amende.lieu_infraction,
            'observations': amende.observations,
            'email_envoye': amende.email_envoye,
            'infraction': {
                'id': amende.infraction.id,
                'code_article': amende.infraction.code_article,
                'description': amende.infraction.description,
                'category': amende.infraction.get_category_display(),
                'montant_base': float(amende.infraction.get_amende()),
            },
            'vehicle': {
                'id': amende.vehicle.id,
                'plate': amende.vehicle.plate,
                'brand': amende.vehicle.brand,
                'model': amende.vehicle.model,
                'color': amende.vehicle.color,
                'year': amende.vehicle.year,
                'is_stolen': amende.vehicle.is_stolen,
                'owner': {
                    'id': amende.vehicle.owner.id,
                    'username': amende.vehicle.owner.username,
                    'first_name': amende.vehicle.owner.first_name,
                    'last_name': amende.vehicle.owner.last_name,
                    'email': amende.vehicle.owner.email,
                }
            },
            'agent': {
                'id': amende.agent.id if amende.agent else None,
                'username': amende.agent.username if amende.agent else 'Système',
                'full_name': amende.agent.get_full_name() if amende.agent else 'Système automatique',
            }
        }
        
        return JsonResponse({
            'success': True,
            'amende': amende_data
        })
        
    except Amende.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': f'Aucune amende trouvée avec le numéro: {numero_amende}'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erreur lors de la recherche: {str(e)}'
        })


@login_required
def update_amende_status(request):
    """Vue AJAX pour mettre à jour le statut d'une amende"""
    if not request.user.profile.is_agent and not request.user.is_staff:
        return JsonResponse({
            'success': False,
            'message': 'Accès non autorisé'
        })
    
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'message': 'Méthode non autorisée'
        })
    
    try:
        amende_id = request.POST.get('amende_id')
        nouveau_statut = request.POST.get('statut')
        observations = request.POST.get('observations', '')
        
        if not amende_id or not nouveau_statut:
            return JsonResponse({
                'success': False,
                'message': 'ID de l\'amende et nouveau statut requis'
            })
        
        # Vérifier que le statut est valide
        statuts_valides = ['EMISE', 'PAYEE', 'CONTESTEE', 'ANNULEE']
        if nouveau_statut not in statuts_valides:
            return JsonResponse({
                'success': False,
                'message': 'Statut invalide'
            })
        
        # Récupérer et mettre à jour l'amende
        amende = Amende.objects.get(id=amende_id)
        ancien_statut = amende.statut
        
        amende.statut = nouveau_statut
        
        # Mettre à jour les observations si fournies
        if observations.strip():
            if amende.observations:
                amende.observations += f"\n[{request.user.username} - {amende.date_emission.strftime('%d/%m/%Y %H:%M')}]: {observations}"
            else:
                amende.observations = f"[{request.user.username} - {amende.date_emission.strftime('%d/%m/%Y %H:%M')}]: {observations}"
        
        # Si l'amende est marquée comme payée, enregistrer la date de paiement
        if nouveau_statut == 'PAYEE' and ancien_statut != 'PAYEE':
            from django.utils import timezone
            amende.date_paiement = timezone.now()
        
        amende.save()
        
        return JsonResponse({
            'success': True,
            'message': f'Statut de l\'amende mis à jour: {ancien_statut} → {amende.get_statut_display()}',
            'amende': {
                'id': amende.id,
                'statut': amende.statut,
                'statut_display': amende.get_statut_display(),
                'date_paiement': amende.date_paiement.strftime('%d/%m/%Y à %H:%M') if amende.date_paiement else None,
                'observations': amende.observations,
            }
        })
        
    except Amende.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Amende introuvable'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erreur lors de la mise à jour: {str(e)}'
        })


@login_required
def generate_agent_code(request):
    """Génère un nouveau code agent (Admin seulement)"""
    print(f"generate_agent_code appelée par {request.user.username}")
    print(f"User is_staff: {request.user.is_staff}")
    print(f"Method: {request.method}")
    
    if not request.user.is_staff:
        print("Accès refusé - utilisateur non staff")
        return JsonResponse({
            'success': False,
            'message': 'Accès non autorisé'
        })
    
    if request.method == 'POST':
        try:
            print("Tentative de génération de code...")
            # Générer un nouveau code
            agent_code = AgentCode.generate_code(created_by=request.user)
            print(f"Code généré: {agent_code.code}")
            
            return JsonResponse({
                'success': True,
                'message': 'Code agent généré avec succès',
                'code': {
                    'id': agent_code.id,
                    'code': agent_code.code,
                    'created_at': agent_code.created_at.strftime('%d/%m/%Y à %H:%M'),
                    'created_by': agent_code.created_by.get_full_name() or agent_code.created_by.username,
                    'is_used': agent_code.is_used
                }
            })
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Erreur lors de la génération: {str(e)}'
            })
    
    return JsonResponse({
        'success': False,
        'message': 'Méthode non autorisée'
    })


@login_required
def get_recent_agent_codes(request):
    """Récupère la liste des codes agents récents (Admin seulement)"""
    if not request.user.is_staff:
        return JsonResponse({
            'success': False,
            'message': 'Accès non autorisé'
        })
    
    try:
        # Récupérer les 10 codes les plus récents
        recent_codes = AgentCode.objects.all()[:10]
        
        codes_data = []
        for code in recent_codes:
            codes_data.append({
                'id': code.id,
                'code': code.code,
                'created_at': code.created_at.strftime('%d/%m/%Y à %H:%M'),
                'created_by': code.created_by.get_full_name() or code.created_by.username,
                'is_used': code.is_used,
                'used_by': code.used_by.get_full_name() if code.used_by else None,
                'used_at': code.used_at.strftime('%d/%m/%Y à %H:%M') if code.used_at else None
            })
        
        return JsonResponse({
            'success': True,
            'codes': codes_data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erreur lors de la récupération: {str(e)}'
        })


@login_required
@permission_required('detection.add_detection', raise_exception=True)
def get_infractions(request):
    """Récupère la liste de toutes les infractions disponibles"""
    try:
        infractions = Infraction.objects.filter(
            amount_min__isnull=False
        ) | Infraction.objects.filter(
            amount_max__isnull=False
        )
        
        infractions_data = []
        for infraction in infractions.distinct():
            infractions_data.append({
                'id': infraction.id,
                'code_article': infraction.code_article,
                'description': infraction.description,
                'category': infraction.category,
                'category_display': infraction.get_category_display(),
                'montant_min': float(infraction.amount_min) if infraction.amount_min else None,
                'montant_max': float(infraction.amount_max) if infraction.amount_max else None,
                'montant_base': float(infraction.get_amende())
            })
        
        return JsonResponse({
            'success': True,
            'infractions': infractions_data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erreur lors de la récupération des infractions: {str(e)}'
        }, status=500)


@login_required
@permission_required('detection.add_detection', raise_exception=True)
def emettre_amende_agent(request):
    """Émet une amende depuis l'espace agent"""
    if request.method == 'POST':
        try:
            import json
            from datetime import datetime, timedelta
            
            data = json.loads(request.body)
            
            # Récupérer les données
            vehicle_id = data.get('vehicle_id')
            infraction_id = data.get('infraction_id')
            lieu_infraction = data.get('lieu_infraction', '')
            observations = data.get('observations', '')
            
            # Validation
            if not all([vehicle_id, infraction_id, lieu_infraction]):
                return JsonResponse({
                    'success': False,
                    'message': 'Véhicule, infraction et lieu requis'
                }, status=400)
            
            # Récupérer les objets
            try:
                vehicle = Vehicle.objects.get(id=vehicle_id)
                infraction = Infraction.objects.get(id=infraction_id)
            except (Vehicle.DoesNotExist, Infraction.DoesNotExist) as e:
                return JsonResponse({
                    'success': False,
                    'message': 'Véhicule ou infraction non trouvé'
                }, status=404)
            
            # Vérifier que l'infraction a une amende
            if not infraction.has_amende():
                return JsonResponse({
                    'success': False,
                    'message': 'Cette infraction n\'a pas d\'amende définie'
                }, status=400)
            
            # Créer l'amende
            amende = Amende.objects.create(
                detection=None,  # Pas de détection associée depuis l'espace agent
                infraction=infraction,
                vehicle=vehicle,
                agent=request.user,
                lieu_infraction=lieu_infraction,
                observations=observations,
                date_limite_paiement=datetime.now().date() + timedelta(days=30)
            )
            
            # Envoyer l'email au propriétaire
            email_sent = False
            try:
                from detection.views import send_amende_email
                email_sent = send_amende_email(amende)
                if email_sent:
                    amende.email_envoye = True
                    amende.save()
            except Exception as e:
                # On continue même si l'email échoue
                pass
            
            return JsonResponse({
                'success': True,
                'message': f'Amende {amende.numero_amende} émise avec succès',
                'amende': {
                    'numero': amende.numero_amende,
                    'montant': float(amende.montant),
                    'infraction': infraction.description,
                    'code_article': infraction.code_article,
                    'date_emission': amende.date_emission.strftime('%d/%m/%Y %H:%M'),
                    'date_limite': amende.date_limite_paiement.strftime('%d/%m/%Y'),
                    'email_envoye': email_sent,
                    'vehicle_plate': vehicle.plate
                }
            })
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Erreur lors de l\'émission d\'amende: {str(e)}'
            }, status=500)
    
    return JsonResponse({
        'success': False,
        'message': 'Méthode non autorisée'
    }, status=405)