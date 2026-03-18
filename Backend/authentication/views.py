from rest_framework import viewsets, generics, status, permissions
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from .models import User, UserPreferences
from .serializers import (
    UserSerializer, UserRegistrationSerializer,
    UserPreferencesSerializer, PasswordChangeSerializer,
    AccountProfileSerializer, AvatarUploadSerializer,
)


class UserViewSet(viewsets.ModelViewSet):
    """
    User management viewset
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    # Permissions disabled for development - enable later
    # permission_classes = [permissions.IsAuthenticated]
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and user.role in ['admin', 'dos']:
            return User.objects.all()
        if user.is_authenticated:
            return User.objects.filter(id=user.id)
        return User.objects.all()  # Allow all for development
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile"""
        if not request.user.is_authenticated:
            return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def register(self, request):
        """Register new user"""
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Create user preferences
        UserPreferences.objects.get_or_create(user=user)
        
        return Response({
            'user': UserSerializer(user).data,
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Change user password"""
        if not request.user.is_authenticated:
            return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
            
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({
                'error': 'Old password is incorrect'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        return Response({
            'message': 'Password changed successfully'
        })


class AuthViewSet(viewsets.ViewSet):
    """
    Authentication endpoints
    """
    permission_classes = [permissions.AllowAny]
    
    @action(detail=False, methods=['post'])
    def login(self, request):
        """Login user — accepts username or email + password"""
        identifier = request.data.get('username') or request.data.get('email')
        password   = request.data.get('password')

        if not identifier or not password:
            return Response(
                {'error': 'username/email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Try username first, then fall back to email lookup
        user = authenticate(username=identifier, password=password)

        if user is None:
            # identifier might be an email — find the matching username and retry
            try:
                matched = User.objects.get(email__iexact=identifier)
                user = authenticate(username=matched.username, password=password)
            except User.DoesNotExist:
                pass

        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'access':  str(refresh.access_token),
                'refresh': str(refresh),
                'user':    UserSerializer(user).data,
            })

        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    
    @action(detail=False, methods=['post'])
    def logout(self, request):
        """Logout user"""
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logout successful'})
        except Exception:
            return Response({
                'error': 'Invalid token'
            }, status=status.HTTP_400_BAD_REQUEST)


class UserPreferencesViewSet(viewsets.ModelViewSet):
    """
    User preferences viewset
    """
    serializer_class = UserPreferencesSerializer
    # Permissions disabled for development
    # permission_classes = [permissions.IsAuthenticated]
    permission_classes = [permissions.AllowAny]
    http_method_names = ['get', 'put', 'patch']

    def get_queryset(self):
        # Return all for development
        return UserPreferences.objects.all()

    def get_object(self):
        # Always return the current user's preferences, create if not exists
        if self.request.user.is_authenticated:
            preferences, _ = UserPreferences.objects.get_or_create(user=self.request.user)
            return preferences
        return UserPreferences.objects.first()  # Fallback for development


class AccountProfileView(generics.RetrieveUpdateAPIView):
    """
    Personal Profile section of Account Settings.

    GET   /imboni/account/profile/  — fetch current user's profile
    PATCH /imboni/account/profile/  — update first_name, last_name, email, phone_number
    """
    serializer_class = AccountProfileSerializer
    # permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch']

    def get_object(self):
        # For development fall back to first user when unauthenticated
        if self.request.user.is_authenticated:
            return self.request.user
        return User.objects.filter(role='parent').first()


class AccountAvatarView(APIView):
    """
    Change Photo button on the Personal Profile section.

    PATCH /imboni/account/avatar/
    Body: multipart/form-data with field 'avatar' (image file)
    """
    parser_classes = [MultiPartParser, FormParser]
    # permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        user = request.user if request.user.is_authenticated else User.objects.filter(role='parent').first()
        serializer = AvatarUploadSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'avatar': serializer.data['avatar']})


class PasswordResetRequestView(APIView):
    """
    Step 1 — User submits their email.
    POST /imboni/auth/password-reset/
    Body: { "email": "user@school.com" }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()

        if not email:
            return Response(
                {'error': 'Email is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({'detail': 'If this email is registered, a reset link has been sent.'})

        token = default_token_generator.make_token(user)
        uid   = urlsafe_base64_encode(force_bytes(user.pk))

        reset_link = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"

        # Render HTML email template
        context = {
            'first_name': user.first_name or user.username,
            'email':      user.email,
            'reset_link': reset_link,
        }
        html_body  = render_to_string('emails/password_reset.html', context)
        plain_body = f'Click the link below to reset your password:\n\n{reset_link}\n\nThis link expires in 3 days.'

        email_msg = EmailMultiAlternatives(
            subject='Password Reset — Imboni School',
            body=plain_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        email_msg.attach_alternative(html_body, 'text/html')
        email_msg.send()

        return Response({'detail': 'If this email is registered, a reset link has been sent.'})


class PasswordResetConfirmView(APIView):
    """
    Step 2 — User submits new password with uid and token from the email link.
    POST /imboni/auth/password-reset/confirm/
    Body: { "uid": "...", "token": "...", "new_password": "..." }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid          = request.data.get('uid')
        token        = request.data.get('token')
        new_password = request.data.get('new_password')

        if not uid or not token or not new_password:
            return Response(
                {'error': 'uid, token and new_password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            pk   = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {'error': 'Invalid reset link.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {'error': 'Reset link has expired or already been used.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()

        return Response({'detail': 'Password reset successful. You can now log in.'})
