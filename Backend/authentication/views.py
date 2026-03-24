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
from django.utils import timezone
from django.core.mail import EmailMultiAlternatives, send_mail
from django.template.loader import render_to_string
from django.conf import settings
from datetime import timedelta
from .service import dispatch_invitation
from .permissions import CanInvite
from .models import User, UserPreferences,Invitation
from .serializers import (
    UserSerializer, UserRegistrationSerializer,
    UserPreferencesSerializer, PasswordChangeSerializer,
    AccountProfileSerializer, AvatarUploadSerializer,
    InvitationSerializer,CompleteRegistrationSerializer,
    EmailChangeRequestSerializer, CSVInviteSerializer,
)



class UserViewSet(viewsets.ModelViewSet):
    """
    User management viewset
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
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
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
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
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'put', 'patch']

    def get_queryset(self):
        # Return all for development
        return UserPreferences.objects.all()

    def get_object(self):
        preferences, _ = UserPreferences.objects.get_or_create(user=self.request.user)
        return preferences


class AccountProfileView(generics.RetrieveUpdateAPIView):
    """
    Personal Profile section of Account Settings.

    GET   /imboni/account/profile/  — fetch current user's profile
    PATCH /imboni/account/profile/  — update first_name, last_name, email, phone_number
    """
    serializer_class = AccountProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch']

    def get_object(self):
        return self.request.user


class AccountAvatarView(APIView):
    """
    Change Photo button on the Personal Profile section.

    PATCH /imboni/account/avatar/
    Body: multipart/form-data with field 'avatar' (image file)
    """
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        user = request.user
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

class SendInvitationView(APIView):
    """
    POST /imboni/auth/invite/
    Body: { first_name, last_name, role, email(optional), phone_number(optional) }
    Who: Admin, DOS, Discipline Master
    """
    permission_classes = [CanInvite]
    def post(self,request):
        permission = CanInvite()
        # Check if this user can invite the requested role
        target_role = request.data.get('role')
        if not permission.can_invite_role(request.user.role,target_role):
            return Response(
                {'error':f'You cannot invite users with role:{target_role}'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer =InvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Generate token and uid for the invitation link
        expires_at = timezone.now() + timedelta(days=settings.INVITATION_EXPIRY_DAYS)
        invitation  = serializer.save(
            invited_by=request.user,
            expires_at=expires_at,
            token='pending',
            uid='pending',
        )
        token = default_token_generator.make_token(request.user)
        uid   = urlsafe_base64_encode(force_bytes(invitation.pk))
        invitation.token = token
        invitation.uid   = uid
        invitation.save()

        registration_link = f"{settings.FRONTEND_URL}/register/{uid}/{token}/"

        #send to all available channels 
        channels = dispatch_invitation(invitation,registration_link)
        invitation.channels_sent = channels
        invitation.delivery_status = 'sent' if channels else 'failed'
        invitation.save()

        return Response({
            'detail':'Invitation sent successfully. ',
            'channels_sent': channels,
            'invitation': InvitationSerializer(invitation).data,
        },status=status.HTTP_201_CREATED)
    
class BulkInviteView(APIView):
    """
    POST /imboni/auth/invite/bulk/
    Body: { "invitations": [ {first_name, last_name, role, email, phone_number}, ... ] }
    Who: Admin, DOS, Discipline Master
    """
    permission_classes = [CanInvite]
    
    def post(self,request):
        permission = CanInvite()
        invitations = request.data.get('invitations',[])

        if not invitations:
            return Response(
                {'error':'No invitations provided.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        results ={'sent':[],'failed':[]}

        for item in invitations:
            target_role = item.get('role')

            if not permission.can_invite_role(request.user.role,target_role):
                results['failed'].append({
                    'email': item.get('email',''),
                    'reason':f'Cannot invite role:{target_role}'
                })
                continue
            serializer = InvitationSerializer(data=item)

            if not serializer.is_valid():
                results['failed'].append({
                  'email':item.get('email',''),
                  'reason': serializer.errors 
                })
                continue

            invitation = serializer.save(invited_by=request.user)
            uid = urlsafe_base64_encode(force_bytes(invitation.pk))
            token=default_token_generator.make_token(request.user)
            invitation.token= token
            invitation.uid=uid
            invitation.expires_at=timezone.now()+timedelta(days=settings.INVITATION_EXPIRY_DAYS)
            invitation.save()

            registration_link = f"{settings.FRONTEND_URL}/register/{uid}/{token}/"
            channels = dispatch_invitation(invitation,registration_link)
            invitation.channels_sent =channels
            invitation.delivery_status = 'sent' if channels else 'failed'
            invitation.save()

            results['sent'].append({
                'email': invitation.email,
                'phone': invitation.phone_number,
                'channels': channels,
            })
        return Response( results,status=status.HTTP_201_CREATED)
    
class InvitationListView(generics.ListAPIView):
    """
    GET /imboni/auth/invite/list/
    Returns all invitations sent by current user's organization.
    """
    serializer_class = InvitationSerializer
    permission_classes = [CanInvite]

    def get_queryset(self):
        if self.request.user.role == "admin":
            return Invitation.objects.all()
        return Invitation.objects.filter(invited_by=self.request.user)

class ResendInvitationView(APIView):
    """
    POST /imboni/auth/invite/resend/<pk>/
    Generates a new token and resends to same channels.
    """
    permission_classes= [CanInvite]
    
    def post(self, request, pk):
        try:
            invitation = Invitation.objects.get(pk=pk)
        except Invitation.DoesNotExist:
            return Response({'error': 'Invitation not found.'}, status=404)

        if invitation.is_used:
            return Response(
                {'error': 'This invitation has already been used.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate fresh token and extend expiry
        uid                   = urlsafe_base64_encode(force_bytes(invitation.pk))
        token                 = default_token_generator.make_token(request.user)
        invitation.token      = token
        invitation.uid        = uid
        invitation.expires_at = timezone.now() + timedelta(days=settings.INVITATION_EXPIRY_DAYS)
        invitation.delivery_status = 'pending'
        invitation.save()

        registration_link        = f"{settings.FRONTEND_URL}/register/{uid}/{token}/"
        channels                 = dispatch_invitation(invitation, registration_link)
        invitation.channels_sent = channels
        invitation.delivery_status = 'sent' if channels else 'failed'
        invitation.save()

        return Response({
            'detail':        'Invitation resent successfully.',
            'channels_sent': channels,
        })

class CancelInvitationView(APIView):
    """
    DELETE /imboni/auth/invite/<pk>/cancel/
    """
    permission_classes = [CanInvite]

    def delete(self , request ,pk):
        try:
            invitation = Invitation.objects.get(pk=pk)
        except Invitation.DoesNotExist:
            return Response({'error':'Invitation not found.'}, status=404)

        if invitation.is_used:
            return Response(
                {'error':'Cannot cancel an already used invitation.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invitation.delete()
        return Response({
            'detail' : 'Invitation cancelled.'
        },
        status=status.HTTP_204_NO_CONTENT
        ) 
    
class CSVInviteView(APIView):
    """
    POST /imboni/auth/invite/csv/
    Upload a CSV file to send invitations to multiple people at once.

    Form fields:
        file         — CSV file (required)
        default_role — fallback role if CSV row has no role column (default: student)

    CSV columns: first_name, last_name, role, email (optional), phone_number (optional)
    At least one of email or phone_number must be present per row.

    Who: Admin, DOS, Discipline
    """
    permission_classes = [CanInvite]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        import csv
        import io

        serializer = CSVInviteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        csv_file     = serializer.validated_data['file']
        default_role = serializer.validated_data['default_role']
        permission   = CanInvite()

        try:
            content = csv_file.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            return Response(
                {'error': 'File must be UTF-8 encoded. Save your spreadsheet as CSV UTF-8.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reader = csv.DictReader(io.StringIO(content))

        # Normalize headers to lowercase and strip spaces
        reader.fieldnames = [h.strip().lower() for h in (reader.fieldnames or [])]

        results = {'sent': [], 'failed': []}

        for idx, row in enumerate(reader, start=2):  # start=2 because row 1 is header
            # Strip whitespace from all values
            row = {k: (v.strip() if v else '') for k, v in row.items()}

            first_name   = row.get('first_name', '')
            last_name    = row.get('last_name', '')
            role         = row.get('role', '').lower() or default_role
            email        = row.get('email', '')
            phone_number = row.get('phone_number', '')
            class_id     = row.get('class_id', '').strip() or row.get('class_obj_id', '').strip()

            # Validate required fields
            if not first_name or not last_name:
                results['failed'].append({
                    'row': idx,
                    'email': email,
                    'reason': 'first_name and last_name are required.',
                })
                continue

            if not email and not phone_number:
                results['failed'].append({
                    'row': idx,
                    'email': email,
                    'reason': 'At least one of email or phone_number is required.',
                })
                continue

            # Check permission for this role
            if not permission.can_invite_role(request.user.role, role):
                results['failed'].append({
                    'row': idx,
                    'email': email,
                    'reason': f'You cannot invite users with role: {role}',
                })
                continue

            # Skip if already invited and not yet used
            if email and Invitation.objects.filter(email=email, is_used=False).exists():
                results['failed'].append({
                    'row': idx,
                    'email': email,
                    'reason': 'An active invitation already exists for this email.',
                })
                continue

            # Resolve class if provided (students only)
            class_obj = None
            if class_id and role == 'student':
                from teacher.models import Class
                class_obj = Class.objects.filter(pk=class_id).first()
                if not class_obj:
                    results['failed'].append({
                        'row':    idx,
                        'email':  email,
                        'reason': f'Class with id {class_id} not found.',
                    })
                    continue

            # Create invitation
            try:
                expires_at = timezone.now() + timedelta(days=settings.INVITATION_EXPIRY_DAYS)
                invitation = Invitation.objects.create(
                    first_name   = first_name,
                    last_name    = last_name,
                    role         = role,
                    email        = email or '',
                    phone_number = phone_number or '',
                    invited_by   = request.user,
                    expires_at   = expires_at,
                    token        = 'pending',
                    uid          = 'pending',
                    class_obj    = class_obj,
                )

                token = default_token_generator.make_token(request.user)
                uid   = urlsafe_base64_encode(force_bytes(invitation.pk))
                invitation.token = token
                invitation.uid   = uid
                invitation.save()

                registration_link = f"{settings.FRONTEND_URL}/register/{uid}/{token}/"
                channels = dispatch_invitation(invitation, registration_link)
                invitation.channels_sent    = channels
                invitation.delivery_status  = 'sent' if channels else 'failed'
                invitation.save()

                results['sent'].append({
                    'row':      idx,
                    'name':     f"{first_name} {last_name}",
                    'role':     role,
                    'email':    email,
                    'phone':    phone_number,
                    'channels': channels,
                })

            except Exception as exc:
                results['failed'].append({
                    'row':    idx,
                    'email':  email,
                    'reason': str(exc),
                })

        status_code = (
            status.HTTP_201_CREATED if results['sent']
            else status.HTTP_400_BAD_REQUEST
        )
        return Response({
            'total_sent':   len(results['sent']),
            'total_failed': len(results['failed']),
            'sent':         results['sent'],
            'failed':       results['failed'],
        }, status=status_code)


class VerifyInvitationView(APIView):
    """
    GET /imboni/auth/register/verify/<uid>/<token>/
    React calls this when user clicks the invitation link.
    Returns invitation details if valid.
    """
    permission_classes = [permissions.AllowAny]

    def get(self,request ,uid , token):
        try:
            pk = urlsafe_base64_decode(uid).decode()
            invitation = Invitation.objects.get(pk=pk)
        except (Invitation.DoesNotExist,ValueError,TypeError):
            return Response({
                'error':'Invalid invitation link.'
            },
            status=status.HTTP_400_BAD_REQUEST
            )
        if invitation.is_used:
            return Response({
                'error': 'This invitation has already been used.'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
        if invitation.is_expired:
            return Response({
                'error':'this invitation link has expired. contact your administatir .'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
        if invitation.token != token:
            return Response({
                'error':'Invalid invitation link'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
        return Response({
            'valid':      True,
            'first_name': invitation.first_name,
            'last_name':  invitation.last_name,
            'role':       invitation.role,
            'email':      invitation.email,
            'phone':      invitation.phone_number,
        })

class CompleteRegistrationView(APIView):
    """
    POST /imboni/auth/register/complete/
    Body: { uid, token, username, password, confirm_password, phone_number, date_of_birth }
    """
    permission_classes = [permissions.AllowAny]

    def post(self,request):
        serializer = CompleteRegistrationSerializer(data =request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        #verify the invitation again
        try:
            pk =urlsafe_base64_decode(data['uid']).decode()
            invitation = Invitation.objects.get(pk=pk)
        except (Invitation.DoesNotExist,ValueError,TypeError):
            return Response(
                {'error':'Invalid invitation link.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not invitation.is_valid:
            return Response(
                {'error': 'Invitation link has expired or already been used.'}, 
                  status=400
                )
        if invitation.token != data['token']:
            return Response({'error': 'Invalid invitation link.'}, status=400)

        # Check username is not taken
        if User.objects.filter(username=data['username']).exists():
            return Response({
                'error':'This username is already taken'
            },
            status=status.HTTP_400_BAD_REQUEST)
        #create the user account 
        user = User.objects.create_user(
            username = data['username'],
            email =invitation.email,
            password =data['password'],
            first_name=invitation.first_name,
            last_name = invitation.last_name,
            role = invitation.role,
            phone_number = data.get('phone_number', invitation.phone_number),
            date_of_birth =data.get('date_of_birth')
        )
        # Create user preferences
        UserPreferences.objects.get_or_create(user=user)

        # Auto-assign student to class if invitation had a class
        if invitation.role == 'student' and invitation.class_obj:
            try:
                from teacher.models import ClassAssignment
                from results.models import AcademicTerm
                from parents.models import Student as StudentProfile
                current_term = AcademicTerm.objects.filter(is_current=True).first()
                student_profile = StudentProfile.objects.filter(user=user).first()
                if current_term and student_profile:
                    ClassAssignment.objects.get_or_create(
                        class_obj=invitation.class_obj,
                        student=student_profile,
                        term=current_term,
                    )
            except Exception:
                pass  # Class assignment failure should not block registration

        # Mark invitation as used
        invitation.is_used = True
        invitation.save()

        # Send welcome email/sms/WhatsApp
        _send_welcome_message(user)

        return Response({
            'detail':'Registration successful.you ca now log in.',
            'user':UserSerializer(user).data,
        },status=status.HTTP_201_CREATED)
    
def _send_welcome_message(user):
        """Send welcome message via same channels as invitation."""
        login_link = f"{settings.FRONTEND_URL}/login/"

        if user.email:
            try:
                html_message = render_to_string(
                    'emails/welcome_email.html',
                    {
                        'first_name': user.first_name,
                        'role':       user.get_role_display() if hasattr(user, 'get_role_display') else user.role,
                        'username':   user.username,
                        'login_link': login_link, 
                    })
                send_mail(
                    subject = 'Welcome to Imboni School System',
                    message = F'Welcome {user.first_name}! Login here: {login_link}',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    html_message=html_message,
                    fail_silently =True,
                )
            except Exception:
                pass

class EmailChangeRequestView(APIView):
    """
    POST /imboni/auth/email-change/request/
    Body: { "new_email": "newemail@school.com" }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = EmailChangeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_email =serializer.validated_data['new_email']

        user=request.user
        user.pending_email =new_email
        user.save()

        #generate verification token
        token =default_token_generator.make_token(user)
        uid= urlsafe_base64_encode(force_bytes(user.pk))

        confirm_link=f"{settings.FRONTEND_URL}/email-change/confirm/{uid}/{token}/"

        send_mail(
            subject='Confirm your new email - Imboni School',
            message = f'click to confirm your new email:{confirm_link}',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[new_email],
            fail_silently =False,
        )
        
        return Response({'detail':'A confirmation link has been sent to your new email.'})

class EmailChangeConfirmView(APIView):
    """
    GET /imboni/auth/email-change/confirm/<uid>/<token>/
    """
    permission_classes = [permissions.AllowAny]

    def get(self,request,uid,token):
        try:
            pk= urlsafe_base64_decode(uid).decode()
            user=User.objects.get(pk=pk)
        except (User.DoesNotExist,ValueError,TypeError):
            return Response(
                {
                    'error':'link has expired or already been used'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not user.pending_email:
            return Response(
                {
                    'error' :'No pending email change found'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_email = user.email
        user.email = user.pending_email
        user.pending_email = ''
        user.save()

        #notify old email about the change
        send_mail (
            subject='Your email has been changed - IMboni school',
            message =f'Your email was changed from {old_email} to {user.email}.If you did not do this,contact the administrator immediately.',
            from_email= settings.DEFAULT_FROM_EMAIL,
            recipient_list=[old_email],
            fail_silently=True,
        )
        return Response (
            {
                'detail':'Email updated successfully.'
            }
        )