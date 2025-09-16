from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.contrib import messages
import json
from .models import Vehicle

@login_required
def vehicle_list(request):
    """Page de gestion des véhicules de l'utilisateur"""
    vehicles = Vehicle.objects.filter(owner=request.user)
    return render(request, 'vehicules/vehicle_list.html', {'vehicles': vehicles})

@login_required
@csrf_exempt
def add_vehicle(request):
    """Ajouter un nouveau véhicule en AJAX"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            # Vérifier si la plaque existe déjà
            if Vehicle.objects.filter(plate=data['plate']).exists():
                return JsonResponse({
                    'success': False,
                    'error': 'Cette plaque d\'immatriculation existe déjà.'
                })
            
            # Créer le véhicule
            vehicle = Vehicle.objects.create(
                plate=data['plate'].upper(),
                brand=data['brand'],
                model=data['model'],
                color=data['color'],
                year=data.get('year') or None,
                owner=request.user
            )
            
            return JsonResponse({
                'success': True,
                'vehicle': {
                    'id': vehicle.id,
                    'plate': vehicle.plate,
                    'brand': vehicle.brand,
                    'model': vehicle.model,
                    'color': vehicle.color,
                    'year': vehicle.year,
                    'is_stolen': vehicle.is_stolen,
                    'created_at': vehicle.created_at.strftime('%d/%m/%Y à %H:%M')
                }
            })
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': f'Erreur lors de l\'ajout: {str(e)}'
            })
    
    return JsonResponse({'success': False, 'error': 'Méthode non autorisée'})

@login_required
@csrf_exempt
def toggle_stolen(request, vehicle_id):
    """Basculer le statut volé d'un véhicule en AJAX"""
    if request.method == 'POST':
        try:
            vehicle = get_object_or_404(Vehicle, id=vehicle_id, owner=request.user)
            
            vehicle.is_stolen = not vehicle.is_stolen
            if vehicle.is_stolen:
                vehicle.stolen_date = timezone.now()
            else:
                vehicle.stolen_date = None
            vehicle.save()
            
            return JsonResponse({
                'success': True,
                'is_stolen': vehicle.is_stolen,
                'stolen_date': vehicle.stolen_date.strftime('%d/%m/%Y à %H:%M') if vehicle.stolen_date else None
            })
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': f'Erreur: {str(e)}'
            })
    
    return JsonResponse({'success': False, 'error': 'Méthode non autorisée'})

@login_required
@csrf_exempt
def delete_vehicle(request, vehicle_id):
    """Supprimer un véhicule en AJAX"""
    if request.method == 'DELETE':
        try:
            vehicle = get_object_or_404(Vehicle, id=vehicle_id, owner=request.user)
            vehicle.delete()
            
            return JsonResponse({'success': True})
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': f'Erreur: {str(e)}'
            })
    
    return JsonResponse({'success': False, 'error': 'Méthode non autorisée'})
