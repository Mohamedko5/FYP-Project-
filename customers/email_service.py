import logging
from smtplib import SMTPException

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


logger = logging.getLogger(__name__)


class EmailDeliveryError(Exception):
    default_detail = 'We could not send the email. Please try again.'

    def __init__(self, detail=None):
        super().__init__(detail or self.default_detail)
        self.detail = detail or self.default_detail


def _send_template_email(subject, to_email, template_name, context, safe_detail=None):
    text_body = render_to_string(f'customers/email/{template_name}.txt', context)
    html_body = render_to_string(f'customers/email/{template_name}.html', context)
    email = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    email.attach_alternative(html_body, 'text/html')
    try:
        email.send(fail_silently=False)
    except (SMTPException, OSError, TimeoutError) as exc:
        logger.warning(
            'Customer email delivery failed for template=%s recipient=%s error=%s',
            template_name,
            to_email,
            exc.__class__.__name__,
        )
        raise EmailDeliveryError(safe_detail) from exc


def _customer_name(registration=None, user=None):
    if registration is not None:
        return registration.full_name or registration.business_name or 'Customer'
    if user is not None:
        full_name = user.get_full_name()
        return full_name or user.email or 'Customer'
    return 'Customer'


def send_customer_verification_email(registration, code):
    _send_template_email(
        subject='Bayad Customer Account Verification Code',
        to_email=registration.email,
        template_name='verify_email',
        context={
            'company_name': 'Bayad Commercial Activities Company',
            'customer_name': _customer_name(registration=registration),
            'code': code,
            'expires_minutes': 10,
        },
        safe_detail='We could not send the verification email. Please try again.',
    )


def send_password_reset_email(user, code):
    _send_template_email(
        subject='Bayad Password Reset Code',
        to_email=user.email,
        template_name='password_reset',
        context={
            'company_name': 'Bayad Commercial Activities Company',
            'customer_name': _customer_name(user=user),
            'code': code,
            'expires_minutes': 10,
        },
        safe_detail='We could not send the password reset email. Please try again.',
    )


def send_registration_approved_email(registration):
    _send_template_email(
        subject='Your Bayad Customer Account Has Been Approved',
        to_email=registration.email,
        template_name='account_approved',
        context={
            'company_name': 'Bayad Commercial Activities Company',
            'customer_name': _customer_name(registration=registration),
        },
        safe_detail='We could not send the account approval email.',
    )


def send_registration_rejected_email(registration):
    _send_template_email(
        subject='Bayad Customer Account Registration Update',
        to_email=registration.email,
        template_name='account_rejected',
        context={
            'company_name': 'Bayad Commercial Activities Company',
            'customer_name': _customer_name(registration=registration),
        },
        safe_detail='We could not send the account rejection email.',
    )
