from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User, Group
from .models import Profile

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
