import json
import httpx
from ..config import Settings


class BackendError(Exception):
    """Safe public backend failure; never includes transport URLs or credentials."""


class AkadverseClient:
    def __init__(self, settings: Settings, callback_token: str, transport=None):
        self.settings = settings
        self.callback_token = callback_token
        self.transport = transport

    async def call(self, payload: dict) -> dict:
        try:
            async with httpx.AsyncClient(timeout=35, follow_redirects=False, transport=self.transport) as client:
                async with client.stream('POST', self.settings.akadverse_api_base_url + '/api/productivity/assistant/service',
                                         headers={'Authorization': 'Bearer ' + self.callback_token,
                                                  'X-Productivity-Service-Token': self.settings.productivity_ai_service_token.get_secret_value()}, json=payload) as response:
                    raw = bytearray()
                    async for chunk in response.aiter_bytes():
                        raw.extend(chunk)
                        if len(raw) > 512_000:
                            raise BackendError('Backend response exceeded the assistant context limit. Narrow the request.')
                    value = json.loads(raw)
                    if response.status_code != 200 or not isinstance(value, dict) or 'result' not in value:
                        raise BackendError('AkadVerse could not confirm this operation. Review its saved status before retrying.')
                    return value['result']
        except (httpx.HTTPError, ValueError):
            raise BackendError('The backend outcome could not be confirmed. Do not retry with a new operation identity.') from None

    async def context(self) -> dict:
        return await self.call({'action': 'context'})

    async def tool(self, step: int, name: str, arguments: dict) -> dict:
        # A transport retry reuses this exact step, name, and argument payload.
        return await self.call({'action': 'tool', 'step': step, 'name': name, 'arguments': arguments})
