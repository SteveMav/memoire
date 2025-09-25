from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User, Group
from django.core.exceptions import ValidationError
from .models import Profile, PasswordResetCode

class LoginForm(forms.Form):
    email = forms.CharField(
        max_length=254,
        label='Adresse email',
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Entrez votre adresse email',
            'autocomplete': 'email'
        })
    )
    password = forms.CharField(
        label='Mot de passe',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Entrez votre mot de passe',
            'autocomplete': 'current-password'
        })
    )

class RegisterForm(UserCreationForm):
    email = forms.EmailField(
        required=True,
        label='Email',
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'votre@email.com'
        })
    )
    first_name = forms.CharField(
        max_length=30,
        required=True,
        label='Prénom',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Votre prénom'
        })
    )
    last_name = forms.CharField(
        max_length=30,
        required=True,
        label='Nom',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Votre nom'
        })
    )
    user_type = forms.ChoiceField(
        choices=Profile.USER_TYPE_CHOICES,
        required=True,
        label='Type de compte',
        widget=forms.Select(attrs={
            'class': 'form-control',
            'id': 'id_user_type'
        })
    )
    agent_number = forms.CharField(
        max_length=20,
        required=False,
        label='Numéro matricule',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Entrez votre numéro matricule',
            'id': 'id_agent_number'
        }),
        help_text='Obligatoire pour les agents'
    )

    class Meta:
        model = User
        fields = ('username', 'first_name', 'last_name', 'email', 'password1', 'password2')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].widget.attrs.update({
            'class': 'form-control',
            'placeholder': 'Choisissez un nom d\'utilisateur'
        })
        self.fields['password1'].widget.attrs.update({
            'class': 'form-control',
            'placeholder': 'Créez un mot de passe'
        })
        self.fields['password2'].widget.attrs.update({
            'class': 'form-control',
            'placeholder': 'Confirmez votre mot de passe'
        })

    def clean_agent_number(self):
        agent_number = self.cleaned_data.get('agent_number')
        user_type = self.data.get('user_type')
        
        # Validation conditionnelle pour les agents
        if user_type == 'agent':
            if not agent_number or agent_number.strip() == '':
                raise forms.ValidationError(
                    'Le numéro matricule est obligatoire pour les agents.'
                )
            # Validation du format du numéro matricule
            if len(agent_number.strip()) < 5:
                raise forms.ValidationError(
                    'Le numéro matricule doit contenir au moins 5 caractères.'
                )
        
        return agent_number

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']
        user.first_name = self.cleaned_data['first_name']
        user.last_name = self.cleaned_data['last_name']
        
        if commit:
            user.save()
            # Update the profile with user type and agent number
            profile = user.profile
            profile.user_type = self.cleaned_data['user_type']
            if self.cleaned_data['user_type'] == 'agent':
                profile.agent_number = self.cleaned_data['agent_number']
                # Add user to agent group
                try:
                    agent_group = Group.objects.get(name='agent')
                    user.groups.add(agent_group)
                except Group.DoesNotExist:
                    # Create the agent group if it doesn't exist
                    agent_group = Group.objects.create(name='agent')
                    user.groups.add(agent_group)
            profile.save()
        
        return user


class PasswordResetRequestForm(forms.Form):
    """Formulaire pour demander un code de récupération de mot de passe"""
    email = forms.EmailField(
        label='Adresse email',
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Entrez votre adresse email',
            'autocomplete': 'email'
        }),
        help_text='Entrez l\'adresse email associée à votre compte'
    )
    
    def clean_email(self):
        email = self.cleaned_data.get('email')
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise ValidationError('Aucun compte n\'est associé à cette adresse email.')
        return email
    
    def get_user(self):
        """Retourne l'utilisateur associé à l'email"""
        email = self.cleaned_data.get('email')
        try:
            return User.objects.get(email=email)
        except User.DoesNotExist:
            return None


class PasswordResetCodeForm(forms.Form):
    """Formulaire pour valider le code de récupération"""
    code = forms.CharField(
        max_length=6,
        min_length=6,
        label='Code de récupération',
        widget=forms.TextInput(attrs={
            'class': 'form-control text-center',
            'placeholder': '000000',
            'style': 'font-size: 1.5rem; letter-spacing: 0.5rem;',
            'maxlength': '6',
            'pattern': '[0-9]{6}',
            'autocomplete': 'off'
        }),
        help_text='Entrez le code à 6 chiffres reçu par email'
    )
    
    def __init__(self, user=None, *args, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)
    
    def clean_code(self):
        code = self.cleaned_data.get('code')
        
        if not code or not code.isdigit():
            raise ValidationError('Le code doit contenir exactement 6 chiffres.')
        
        if self.user:
            try:
                reset_code = PasswordResetCode.objects.get(
                    user=self.user,
                    code=code,
                    is_used=False
                )
                if not reset_code.is_valid():
                    raise ValidationError('Ce code a expiré. Demandez un nouveau code.')
            except PasswordResetCode.DoesNotExist:
                raise ValidationError('Code invalide. Vérifiez le code reçu par email.')
        
        return code
    
    def get_reset_code(self):
        """Retourne l'objet PasswordResetCode correspondant"""
        code = self.cleaned_data.get('code')
        if self.user and code:
            try:
                return PasswordResetCode.objects.get(
                    user=self.user,
                    code=code,
                    is_used=False
                )
            except PasswordResetCode.DoesNotExist:
                return None
        return None


class NewPasswordForm(forms.Form):
    """Formulaire pour définir un nouveau mot de passe"""
    new_password1 = forms.CharField(
        label='Nouveau mot de passe',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Entrez votre nouveau mot de passe',
            'autocomplete': 'new-password'
        }),
        help_text='Votre mot de passe doit contenir au moins 8 caractères.'
    )
    new_password2 = forms.CharField(
        label='Confirmer le mot de passe',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Confirmez votre nouveau mot de passe',
            'autocomplete': 'new-password'
        })
    )
    
    def clean_new_password1(self):
        password = self.cleaned_data.get('new_password1')
        if len(password) < 8:
            raise ValidationError('Le mot de passe doit contenir au moins 8 caractères.')
        return password
    
    def clean_new_password2(self):
        password1 = self.cleaned_data.get('new_password1')
        password2 = self.cleaned_data.get('new_password2')
        
        if password1 and password2 and password1 != password2:
            raise ValidationError('Les deux mots de passe ne correspondent pas.')
        
        return password2
