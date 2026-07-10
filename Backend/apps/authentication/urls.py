from django.urls import path
from rest_framework_nested import routers
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from .views import (
    SendInvitationView,
    BulkInviteView,
    CSVInviteView,
    InvitationListView,
    ResendInvitationView,
    CancelInvitationView,
    VerifyInvitationView,
    CompleteRegistrationView,
    EmailChangeRequestView,
    EmailChangeConfirmView,
    TwoFactorStatusView,
    TwoFactorSetupView,
    TwoFactorVerifyView,
    TwoFactorDisableView,
)


router = routers.DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')
router.register(r'auth', views.AuthViewSet, basename='auth')

# Nested router for user preferences
user_nested_router = routers.NestedDefaultRouter(router, r'users', lookup='user')
user_nested_router.register(r'preferences', views.UserPreferencesViewSet, basename='user-preferences')

urlpatterns = router.urls + user_nested_router.urls + [
    # Account Settings — Personal Profile tab (GET + PATCH)
    path('account/profile/', views.AccountProfileView.as_view(), name='account-profile'),
    # Account Settings — Change Photo button (PATCH with image file)
    path('account/avatar/', views.AccountAvatarView.as_view(), name='account-avatar'),
    # Password Reset
    path('auth/password-reset/', views.PasswordResetRequestView.as_view(), name='password-reset'),
    path('auth/password-reset/confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    # Invitation management
    path('auth/invite/', SendInvitationView.as_view(),    name='send-invitation'),
    path('auth/invite/bulk/',BulkInviteView.as_view(),        name='bulk-invite'),
    path('auth/invite/csv/', CSVInviteView.as_view(),         name='csv-invite'),
    path('auth/invite/list/',InvitationListView.as_view(),    name='invitation-list'),
    path('auth/invite/resend/<uuid:pk>/',ResendInvitationView.as_view(),  name='resend-invitation'),
    path('auth/invite/<uuid:pk>/cancel/',CancelInvitationView.as_view(),  name='cancel-invitation'),
    # Registration via invitation link
    path('auth/register/verify/<str:uid>/<str:token>/',VerifyInvitationView.as_view(),    name='verify-invitation'),
    path('auth/register/complete/', CompleteRegistrationView.as_view(), name='complete-registration'),

    # Email change
    path('auth/email-change/request/',EmailChangeRequestView.as_view(),  name='email-change-request'),
    path('auth/email-change/confirm/<str:uid>/<str:token>/',EmailChangeConfirmView.as_view(),  name='email-change-confirm'),
    # Two-factor authentication (TOTP) — self-service management.
    # The second login step lives on the AuthViewSet at auth/2fa/login/.
    path('auth/2fa/status/',  TwoFactorStatusView.as_view(),  name='2fa-status'),
    path('auth/2fa/setup/',   TwoFactorSetupView.as_view(),   name='2fa-setup'),
    path('auth/2fa/verify/',  TwoFactorVerifyView.as_view(),  name='2fa-verify'),
    path('auth/2fa/disable/', TwoFactorDisableView.as_view(), name='2fa-disable'),
    # JWT token refresh
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
]
