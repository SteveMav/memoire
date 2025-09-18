from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.contrib.auth.decorators import login_required, permission_required
from django.http import JsonResponse
from django.core.paginator import Paginator
from django.db.models import Q
from .forms import LoginForm, RegisterForm
from detection.models import Detection
from vehicules.models import Vehicle

def login_view(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            user = authenticate(request, username=username, password=password)
            
            if user is not None:
                login(request, user)
                messages.success(request, f'Bienvenue {user.first_name or user.username}!')
                return redirect('home')
            else:
                messages.error(request, 'Nom d\'utilisateur ou mot de passe incorrect.')
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