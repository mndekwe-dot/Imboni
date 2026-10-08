"""
MTN MoMo Collection API: ask a parent's phone to approve a payment.

"Request to pay" is the whole of it: we name an amount and a number, the parent
gets a prompt on their phone and enters their PIN, and afterwards we can ask how
it went. No card or PIN ever touches Imboni.

Kept small and behind a client class so the rest of the system (and its tests)
talks to `MomoClient`, never to HTTP. The credentials live in settings and are
the school's own; with none set, `configured()` is False and the feature is off.
"""
import uuid

import requests
from django.conf import settings

TIMEOUT = 20


class MomoError(Exception):
    """The provider refused or could not be reached; the message is safe to show."""


def configured():
    return all(getattr(settings, name, '') for name in ('MOMO_SUBSCRIPTION_KEY', 'MOMO_API_USER', 'MOMO_API_KEY'))


class MomoClient:
    def __init__(self, session=None):
        self.http = session or requests
        self.base = settings.MOMO_BASE_URL.rstrip('/')
        self.key = settings.MOMO_SUBSCRIPTION_KEY

    def _token(self):
        try:
            response = self.http.post(
                f'{self.base}/collection/token/', auth=(settings.MOMO_API_USER, settings.MOMO_API_KEY),
                headers={'Ocp-Apim-Subscription-Key': self.key}, timeout=TIMEOUT)
        except requests.RequestException as exc:
            raise MomoError('Mobile money cannot be reached right now. Try again in a minute.') from exc
        if response.status_code != 200:
            raise MomoError('Mobile money did not accept the school\'s credentials.')
        return response.json()['access_token']

    def _headers(self, extra=None):
        return {'Authorization': f'Bearer {self._token()}', 'Ocp-Apim-Subscription-Key': self.key,
                'X-Target-Environment': settings.MOMO_ENVIRONMENT, **(extra or {})}

    def request_to_pay(self, reference, amount, phone, message):
        """Send the prompt. ``reference`` must be a fresh UUID: it is how we ask about it later."""
        body = {'amount': str(amount), 'currency': settings.MOMO_CURRENCY, 'externalId': str(reference),
                'payer': {'partyIdType': 'MSISDN', 'partyId': phone},
                'payerMessage': message[:150], 'payeeNote': message[:150]}
        try:
            response = self.http.post(
                f'{self.base}/collection/v1_0/requesttopay', json=body, timeout=TIMEOUT,
                headers=self._headers({'X-Reference-Id': str(reference), 'Content-Type': 'application/json'}))
        except requests.RequestException as exc:
            raise MomoError('Mobile money cannot be reached right now. Try again in a minute.') from exc
        if response.status_code != 202:
            raise MomoError('Mobile money did not accept the request. Check the number and try again.')

    def status(self, reference):
        """{'status': 'PENDING'|'SUCCESSFUL'|'FAILED', 'transaction_id': str, 'reason': str}"""
        try:
            response = self.http.get(f'{self.base}/collection/v1_0/requesttopay/{reference}',
                                     headers=self._headers(), timeout=TIMEOUT)
        except requests.RequestException as exc:
            raise MomoError('Mobile money cannot be reached right now.') from exc
        if response.status_code != 200:
            raise MomoError('Mobile money could not say how that payment went.')
        data = response.json()
        return {'status': data.get('status', 'PENDING'),
                'transaction_id': str(data.get('financialTransactionId') or ''),
                'reason': str(data.get('reason') or '')}


def new_reference():
    return uuid.uuid4()
