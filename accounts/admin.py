from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from .models import Profile, PasswordResetCode, AgentCode

class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = 'Profils'

class CustomUserAdmin(UserAdmin):
    inlines = (ProfileInline,)

# Re-register UserAdmin
admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'user_type', 'agent_number', 'phone', 'created_at')
    list_filter = ('user_type', 'created_at')
    search_fields = ('user__username', 'user__email', 'phone', 'agent_number')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    list_display = ('user', 'code', 'created_at', 'expires_at', 'is_used', 'is_valid_status')
    list_filter = ('is_used', 'created_at', 'expires_at')
    search_fields = ('user__username', 'user__email', 'code')
    readonly_fields = ('created_at', 'is_valid_status')
    ordering = ('-created_at',)
    
    def is_valid_status(self, obj):
        """Affiche si le code est encore valide"""
        return obj.is_valid()
    is_valid_status.boolean = True
    is_valid_status.short_description = 'Valide'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')


@admin.register(AgentCode)
class AgentCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'created_at', 'created_by', 'is_used', 'used_by', 'used_at', 'is_available_status')
    list_filter = ('is_used', 'created_at', 'used_at')
    search_fields = ('code', 'created_by__username', 'used_by__username')
    readonly_fields = ('created_at', 'is_available_status')
    ordering = ('-created_at',)
    
    def is_available_status(self, obj):
        """Affiche si le code est disponible"""
        return obj.is_available()
    is_available_status.boolean = True
    is_available_status.short_description = 'Disponible'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('created_by', 'used_by')
    
    def has_change_permission(self, request, obj=None):
        """Empêche la modification des codes utilisés"""
        if obj and obj.is_used:
            return False
        return super().has_change_permission(request, obj)
    
    def has_delete_permission(self, request, obj=None):
        """Empêche la suppression des codes utilisés"""
        if obj and obj.is_used:
            return False
        return super().has_delete_permission(request, obj)
