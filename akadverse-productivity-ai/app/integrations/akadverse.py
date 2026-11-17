import json
import re
import httpx
from ..config import Settings

# Never echo arbitrary backend/transport exception text (URLs can contain credentials).
BACKEND_CODES = {
    'DATABASE_UNAVAILABLE', 'DATABASE_TIMEOUT', 'DATABASE_SCHEMA_MISSING',
    'DATABASE_ACCESS_DENIED', 'DATABASE_CONFIGURATION', 'DATABASE_NOT_FOUND',
    'SIGN_IN_REQUIRED', 'ACCESS_DENIED', 'RECORD_CONFLICT', 'RECORD_NOT_FOUND',
    'INVALID_INPUT', 'REQUEST_FAILED', 'UNEXPECTED_ERROR',
}


class BackendError(Exception):
    """Safe metadata for correlating an assistant failure with its backend request."""
    def __init__(self, message='The backend outcome could not be confirmed.', *, status=None,
                 code='BACKEND_UNAVAILABLE', reference_id=None, action='unknown'):
        super().__init__(message)
        self.status = status
        self.code = code
        self.reference_id = reference_id
        self.action = action

    @property
    def public_message(self):
        messages = {
            'DATABASE_UNAVAILABLE': 'The application database is temporarily unreachable. Please try again shortly.',
            'DATABASE_TIMEOUT': 'The application database is busy or responding too slowly. Please try again shortly.',
            'DATABASE_SCHEMA_MISSING': 'The application database needs a migration. Ask the developer to apply it.',
            'DATABASE_ACCESS_DENIED': 'The application cannot authenticate to its database. Ask the developer to check the database configuration.',
            'BACKEND_TIMEOUT': 'The application backend took too long to respond. Please try again shortly.',
        }
        message = messages.get(self.code, 'AkadVerse could not confirm this operation.')
        if self.reference_id:
            message += ' Reference: ' + self.reference_id + '.'
        return message + ' Review saved operation results before repeating a change.'


class AkadverseClient:
    def __init__(self, settings: Settings, callback_token: str, transport=None):
        self.settings = settings
        self.callback_token = callback_token
        self.transport = transport
        self._client = None

    async def __aenter__(self):
        self._client = httpx.AsyncClient(timeout=35, follow_redirects=False, transport=self.transport)
        await self._client.__aenter__()
        return self

    async def __aexit__(self, *exc):
        client, self._client = self._client, None
        if client is not None:
            await client.__aexit__(*exc)

    async def call(self, payload: dict) -> dict:
        if self._client is None:
            async with self:
                return await self.call(payload)
        action = payload.get('action') if payload.get('action') in ('context', 'tool') else 'unknown'
        try:
            async with self._client.stream('POST', self.settings.akadverse_api_base_url + '/api/productivity/assistant/service',
                                     headers={'Authorization': 'Bearer ' + self.callback_token,
                                              'X-Productivity-Service-Token': self.settings.productivity_ai_service_token.get_secret_value()}, json=payload) as response:
                raw = bytearray()
                async for chunk in response.aiter_bytes():
                    raw.extend(chunk)
                    if len(raw) > 512_000:
                        raise BackendError(code='BACKEND_RESPONSE_TOO_LARGE', status=response.status_code, action=action)
                try:
                    value = json.loads(raw)
                except ValueError:
                    value = None
                if response.status_code != 200:
                    failure = value if isinstance(value, dict) else {}
                    code = failure.get('code')
                    reference = failure.get('referenceId')
                    reference = reference if isinstance(reference, str) and re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', reference) else None
                    raise BackendError(status=response.status_code, code=code if isinstance(code, str) and code in BACKEND_CODES else 'BACKEND_HTTP_ERROR', reference_id=reference, action=action)
                if not isinstance(value, dict) or not isinstance(value.get('result'), dict):
                    raise BackendError(code='BACKEND_INVALID_RESPONSE', status=response.status_code, action=action)
                return value['result']
        except httpx.TimeoutException:
            raise BackendError(code='BACKEND_TIMEOUT', action=action) from None
        except httpx.HTTPError:
            raise BackendError(action=action) from None

    async def context(self) -> dict:
        return await self.call({'action': 'context'})

    async def tool(self, step: int, name: str, arguments: dict) -> dict:
        # No automatic mutation retries. A caller retry must retain the exact operation identity.
        return await self.call({'action': 'tool', 'step': step, 'name': name, 'arguments': arguments})
