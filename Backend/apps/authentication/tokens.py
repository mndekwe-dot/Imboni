"""
School JWTs, stamped with the schema they were issued in.

A school token carries a `user_id` and nothing else identifying. The schema it
belongs to is decided entirely by the Host header on the request that presents
it, and `JWTAuthentication` resolves that id in whatever schema the request
happens to be in — there is no tenant check anywhere in that path.

Today the boundary holds anyway, because `User.id` is a random UUID: a token
from school A names a primary key that does not exist in school B, so it is
rejected. That is a property of the key type, not of the auth layer, and it is
the only thing standing between two schools. It stops holding if a user row is
ever copied or restored between schemas, or if any future tenant-scoped model
authenticates on a sequential key.

So the schema goes in the token and is checked on the way back in. See
`authentication.TenantScopedJWTAuthentication`.
"""
from django.db import connection
from rest_framework_simplejwt.tokens import RefreshToken

SCHEMA_CLAIM = 'schema'


def tokens_for_user(user):
    """A refresh token for `user`, stamped with the current schema."""
    refresh = RefreshToken.for_user(user)
    refresh[SCHEMA_CLAIM] = connection.schema_name
    return refresh
