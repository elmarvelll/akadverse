import secrets
import time
import jwt
from fastapi import Header, HTTPException
from .config import get_settings


def verify_context(token: str, public_key: str, key_id: str, audience: str = 'akadverse-productivity-ai') -> dict:
    try:
        header = jwt.get_unverified_header(token)
        if len(token) > 8192 or header.get('alg') != 'RS256' or header.get('typ') != 'JWT' or header.get('kid') != key_id:
            raise ValueError('Invalid signing header')
        claims = jwt.decode(token, public_key.replace('\\n', '\n'), algorithms=['RS256'],
                            audience=audience, issuer='akadverse-productivity',
                            options={'require': ['sub', 'cid', 'turn', 'jti', 'iat', 'nbf', 'exp']}, leeway=5)
        if type(claims['exp']) is not int or type(claims['iat']) is not int or claims['exp'] <= time.time() or claims['exp'] - claims['iat'] > 300:
            raise ValueError('Invalid token lifetime')
        for name in ('sub', 'cid', 'turn', 'jti'):
            if not isinstance(claims[name], str) or not 1 <= len(claims[name]) <= 200:
                raise ValueError('Invalid token binding')
        return claims
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise HTTPException(401, 'Invalid or expired assistant delegation') from None


async def authenticated(authorization: str = Header(default=''), x_productivity_service_token: str = Header(default='')) -> dict:
    settings = get_settings()
    expected = settings.productivity_ai_service_token.get_secret_value()
    if len(expected) < 32 or not secrets.compare_digest(expected.encode(), x_productivity_service_token.encode()):
        raise HTTPException(401, 'Invalid service credentials')
    if not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Missing delegation')
    return verify_context(authorization[7:], settings.productivity_ai_jwt_public_key, settings.productivity_ai_jwt_key_id)
