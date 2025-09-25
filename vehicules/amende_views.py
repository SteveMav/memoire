from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from .models import Vehicle
from detection.models import Amende

@login_required
def get_vehicle_amendes(request, vehicle_id):
    """Récupérer les amendes d'un véhicule en AJAX"""
    try:
        vehicle = get_object_or_404(Vehicle, id=vehicle_id, owner=request.user)
        amendes = Amende.objects.filter(vehicle=vehicle).select_related('infraction').order_by('-date_emission')
        
        amendes_data = []
        for amende in amendes:
            amendes_data.append({
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
                'infraction': {
                    'code_article': amende.infraction.code_article,
                    'description': amende.infraction.description,
                    'category': amende.infraction.get_category_display(),
                },
                'agent': amende.agent.get_full_name() if amende.agent else 'Non spécifié'
            })
        
        return JsonResponse({
            'success': True,
            'amendes': amendes_data,
            'vehicle': {
                'plate': vehicle.plate,
                'brand': vehicle.brand,
                'model': vehicle.model
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Erreur: {str(e)}'
        })

@login_required
def test_amendes_view(request):
    """Vue de test pour vérifier que les URLs fonctionnent"""
    return JsonResponse({
        'success': True,
        'message': 'Vue des amendes accessible !',
        'user': request.user.username
    })
