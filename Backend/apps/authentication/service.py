import logging

import africastalking
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def initialize_africastalking():
    africastalking.initialize(
        username=settings.AFRICASTALKING_USERNAME,
        api_key=settings.AFRICASTALKING_API_KEY,
    )

def send_invitational_email(invitation , registration_link):
    """Send HTML invitation email."""
    html_message=render_to_string('emails/invitation_email.html',
    {
        'first_name':invitation.first_name,
        'role':invitation.get_role_display(),
        'registration_link':registration_link,
        'expiry_days':settings.INVITATION_EXPIRY_DAYS,
    })
    send_mail(
        subject='You have been invited to Imboni school system',
        message=f'Register here:{registration_link}',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
        html_message=html_message,
        fail_silently=False,
    )

def send_invitation_sms(invitation, registration_link):
    """Send SMS invitation via Africa's Talking."""
    initialize_africastalking()
    sms = africastalking.SMS
    message = (
        f"Hello {invitation.first_name},"
        f"you have been invited to Imboni School System as \
        {invitation.get_role_display()}. "
        f"Register here:{registration_link}"
        f"Link expires in {settings.INVITATION_EXPIRY_DAYS} days."
    )
    sms.send(message,[invitation.phone_number])

def send_invitation_whatsapp(invitation, registration_link):
    """Send WhatsApp invitation via Africa's Talking."""
    initialize_africastalking()
    message = (
        f"Hello {invitation.first_name}!\n\n"
        f"You have been invited to join Imboni School Management"
        f"as {invitation.get_role_display()}. \n\n"
        f"Click to register:\n{registration_link}\n\n"
        f"This link expires in {settings.INVITATION_EXPIRY_DAYS} days.\n"
        f"- Imboni School"
    )
    # Africa's Talking WhatsApp channel    
    africastalking.Whatsapp.send(
        to=invitation.phone_number,
        message=message,
        channel_number=settings.AFRICASTALKING_SENDER_ID,
    )

def dispatch_invitation(invitation , registration_link):
    """
    Main function — detects available channels and sends to all of them.
    Returns list of channels that were successfully sent.
    """
    channels = []

    if invitation.email:
        try:
            send_invitational_email(invitation, registration_link)
            channels.append('email')
        except Exception:
            # Log the invitation, never the address: settings.py keeps Sentry's
            # send_default_pii False precisely so recipient emails do not leave
            # the box, and an interpolated address would defeat that.
            logger.exception('Invitation email failed for invitation %s', invitation.pk)

    if invitation.phone_number:
        try:
            send_invitation_sms(invitation, registration_link)
            channels.append('sms')
        except Exception:
            logger.exception('Invitation SMS failed for invitation %s', invitation.pk)

        try:
            # This branch used to call send_invitation_sms again — the WhatsApp
            # helper was spelled `send_invitation_whatapp`, so the correct name
            # never resolved and every invitation sent two SMS, the second of
            # them reported as 'whatsapp'.
            send_invitation_whatsapp(invitation, registration_link)
            channels.append('whatsapp')
        except Exception:
            logger.exception('Invitation WhatsApp failed for invitation %s', invitation.pk)

    return channels