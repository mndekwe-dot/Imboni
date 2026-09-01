"""Tenant-aware JWT authentication for the per-school API."""
from django.db import connection
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from .tokens import SCHEMA_CLAIM


class TenantScopedJWTAuthentication(JWTAuthentication):
    """
    Stock JWT validation, plus: the token must have been issued in the schema
    the request resolved to.

    Tokens minted before this claim existed have no `schema` and are refused,
    which forces one round of re-logins on deploy. That is the intended
    behaviour — a token whose tenant cannot be established is exactly the thing
    this class exists to reject.
    """

    def get_validated_token(self, raw_token):
        token = super().get_validated_token(raw_token)
        issued_in = token.get(SCHEMA_CLAIM)
        if not issued_in:
            raise InvalidToken('Token predates tenant scoping. Please sign in again.')
        if issued_in != connection.schema_name:
            raise InvalidToken('Token was not issued for this school.')
        return token
