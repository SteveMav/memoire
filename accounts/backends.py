from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import User
from django.db.models import Q


class EmailBackend(ModelBackend):
    """
    Backend d'authentification personnalisé qui permet la connexion avec l'email
    """
    
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get('email')
        
        if username is None or password is None:
            return None
        
        try:
            # Chercher l'utilisateur par email ou username
            user = User.objects.get(
                Q(email=username) | Q(username=username)
            )
        except User.DoesNotExist:
            # Exécuter le hashage du mot de passe par défaut pour éviter les attaques de timing
            User().set_password(password)
            return None
        except User.MultipleObjectsReturned:
            # Si plusieurs utilisateurs ont le même email, prendre le premier
            user = User.objects.filter(
                Q(email=username) | Q(username=username)
            ).first()
        
        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        
        return None
    
    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
