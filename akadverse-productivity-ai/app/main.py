import asyncio
import logging
from typing import Annotated
from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel, ConfigDict, Field
from google.genai.errors import APIError
from .config import get_settings
from .security import authenticated, verify_context
from .integrations.akadverse import AkadverseClient, BackendError
from .integrations.gemini import GeminiClient
from .agent.orchestrator import orchestrate

from .middleware import BoundedBodyMiddleware

app = FastAPI(title='AkadVerse Productivity AI', docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(BoundedBodyMiddleware)
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    conversation_id: str = Field(min_length=8, max_length=200)
    turn_id: str = Field(min_length=8, max_length=200)
    callback_token: str = Field(min_length=20, max_length=8192, repr=False)


@app.get('/health')
async def health():
    return {'status': 'ok'}


@app.post('/api/v1/assistant/chat')
async def chat(payload: ChatRequest, claims: Annotated[dict, Depends(authenticated)]):
    if claims['cid'] != payload.conversation_id or claims['turn'] != payload.turn_id:
        raise HTTPException(403, 'Conversation or turn does not match delegation')
    settings = get_settings()
    callback = verify_context(payload.callback_token, settings.productivity_ai_jwt_public_key, settings.productivity_ai_jwt_key_id, 'akadverse-productivity-backend')
    if any(callback[name] != claims[name] for name in ('sub', 'cid', 'turn')):
        raise HTTPException(403, 'Callback does not match delegation')
    backend = AkadverseClient(settings, payload.callback_token)
    try:
        async with asyncio.timeout(settings.turn_timeout_seconds):
            return await orchestrate(backend, GeminiClient(settings), settings.max_tool_calls)
    except BackendError as error:
        logger.warning('Assistant request failed: category=backend action=%s status=%s code=%s reference_id=%s',
                       error.action, error.status, error.code, error.reference_id)
        return {'message': error.public_message, 'status': 'failed'}
    except APIError as error:
        # Log only a numeric category: provider exception text can contain credentials.
        code = error.code
        logger.warning('Assistant request failed: category=provider status=%s', code if isinstance(code, int) else 'unknown')
        if code in (429, 500, 502, 503, 504):
            message = 'Gemini is temporarily unavailable or busy. Please try again shortly.'
        elif code == 400:
            message = 'Gemini rejected the assistant request format. Ask the developer to inspect the provider integration.'
        else:
            message = 'The Gemini request was rejected. Ask the developer to check the configured model and provider access.'
        return {'message': message + ' Review any saved operation results before repeating a change.', 'status': 'failed'}
    except TimeoutError:
        logger.warning('Assistant request failed: category=timeout')
        return {'message': 'The assistant took too long to respond. Review any saved operation results before trying again.', 'status': 'failed'}
    except Exception:
        logger.warning('Assistant request failed: category=unexpected')
        # Provider exceptions can contain request URLs or credentials. Never echo/log them.
        return {'message': 'The assistant could not finish this request. Confirmed operation results remain saved; please review them before trying again.', 'status': 'failed'}


@app.get('/api/v1/assistant/conversations/{conversation_id}')
async def conversation(conversation_id: str, claims: Annotated[dict, Depends(authenticated)], x_productivity_callback_token: str = Header(default='')):
    if claims['cid'] != conversation_id:
        raise HTTPException(403, 'Conversation does not match delegation')
    settings = get_settings()
    callback = verify_context(x_productivity_callback_token, settings.productivity_ai_jwt_public_key, settings.productivity_ai_jwt_key_id, 'akadverse-productivity-backend')
    if any(callback[name] != claims[name] for name in ('sub', 'cid', 'turn')):
        raise HTTPException(403, 'Callback does not match delegation')
    try:
        return await AkadverseClient(settings, x_productivity_callback_token).context()
    except BackendError:
        raise HTTPException(503, 'Conversation context is unavailable') from None
