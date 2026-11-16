import time
import json
import pytest
import jwt
import httpx
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException
from google.genai import types
from app.tools.registry import DEFINITIONS, validate_call
from app.agent.orchestrator import orchestrate
from app.security import verify_context
from app.config import Settings, get_settings
from app.integrations.akadverse import AkadverseClient, BackendError
from app.main import app
from app.integrations.gemini import provider_schema


def call(name, args):
    return types.Content(role='model', parts=[types.Part.from_function_call(name=name, args=args)])


def answer(text):
    return types.Content(role='model', parts=[types.Part.from_text(text=text)])


class Provider:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.requests = []

    async def generate(self, contents):
        self.requests.append(list(contents))
        return next(self.responses)


class Backend:
    def __init__(self, results=None):
        self.calls = []
        self.results = iter(results or [{'status': 'completed', 'result': {'saved': True}}] * 20)

    async def context(self):
        return {'account': {'student': {'timezone': 'Africa/Lagos'}, 'serverTime': '2026-11-15T12:00:00Z'},
                'messages': [{'role': 'user', 'content': 'Create my task'}], 'pending': [], 'executions': []}

    async def tool(self, step, name, args):
        self.calls.append((step, name, args))
        return next(self.results)


@pytest.fixture
def signing():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    public_pem = private.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    def token(aud='akadverse-productivity-ai', **overrides):
        now = int(time.time())
        payload = dict(sub='student-A', cid='conversation-A', turn='turn-0001', jti='test-jti',
                       iss='akadverse-productivity', aud=aud, iat=now, nbf=now-1, exp=now+300)
        payload.update(overrides)
        return jwt.encode(payload, private_pem, algorithm='RS256', headers={'kid': 'productivity-v1', 'typ': 'JWT'})
    return public_pem, token


@pytest.fixture
def settings(signing):
    return Settings(_env_file=None, gemini_api_key='test-provider-key', akadverse_api_base_url='https://akadverse.test',
                    productivity_ai_service_token='test-service-credential-at-least-32-characters',
                    productivity_ai_jwt_public_key=signing[0])


@pytest.mark.parametrize('definition', DEFINITIONS, ids=lambda item: item['name'])
def test_all_tool_schemas_are_accepted_by_gemini_sdk(definition):
    declaration = types.FunctionDeclaration(**provider_schema(definition))
    assert declaration.name == definition['name']


def test_registry_rejects_invented_tools_identity_injection_and_invalid_dates():
    assert validate_call('create_task', {'input': {'title': 'Read', 'priority': 'high'}})
    for name, args in [('sql', {}), ('get_context', {'userId': 'other'}),
                       ('create_task', {'input': {'title': 'Read', 'priority': 'urgent'}}),
                       ('create_task', {'input': {'title': 'Read', 'priority': 'high', 'ownerId': 'other'}}),
                       ('official_classes', {'start': 'tomorrow', 'end': '2026-11-16'})]:
        with pytest.raises(ValueError): validate_call(name, args)


@pytest.mark.asyncio
async def test_tool_loop_uses_actual_results_and_preserves_model_content():
    backend = Backend()
    tool_content = call('create_task', {'input': {'title': 'Read', 'priority': 'high'}})
    tool_content.parts[0].function_call.id = 'provider-call-001'
    provider = Provider([tool_content, answer('The task was saved.')])
    result = await orchestrate(backend, provider)
    assert result['status'] == 'completed'
    assert backend.calls[0][0] == 0
    assert provider.requests[1][1] is tool_content
    assert provider.requests[1][2].role == 'user'
    assert provider.requests[1][2].parts[0].function_response.response['status'] == 'completed'
    assert provider.requests[1][2].parts[0].function_response.id == 'provider-call-001'


@pytest.mark.asyncio
async def test_confirmation_stops_before_any_later_call():
    backend = Backend([{'status': 'awaiting_confirmation', 'pending_action_id': 'pending-1'}])
    content = call('delete_task', {'task_id': 'task-1'})
    content.parts.append(types.Part.from_function_call(name='create_task', args={'input': {'title': 'Other', 'priority': 'low'}}))
    result = await orchestrate(backend, Provider([content]))
    assert result['status'] == 'awaiting_confirmation'
    assert len(backend.calls) == 1
    assert 'Confirm' in result['message']


@pytest.mark.asyncio
@pytest.mark.parametrize('status', ['failed', 'unknown'])
async def test_failed_or_unknown_operation_is_not_reported_as_success(status):
    backend = Backend([{'status': status, 'error': {'error': 'Could not save'}}])
    result = await orchestrate(backend, Provider([call('create_task', {'input': {'title': 'Read', 'priority': 'low'}})]))
    assert result['status'] == 'failed'
    assert len(backend.calls) == 1
    if status == 'unknown': assert 'Recheck' in result['message']


@pytest.mark.asyncio
async def test_identical_write_cannot_be_repeated_under_another_step():
    write = call('create_task', {'input': {'title': 'Read', 'priority': 'low'}})
    backend = Backend()
    result = await orchestrate(backend, Provider([write, write]))
    assert result['status'] == 'failed'
    assert len(backend.calls) == 1


@pytest.mark.asyncio
async def test_loop_is_bounded_and_invalid_tool_never_reaches_backend():
    backend = Backend()
    result = await orchestrate(backend, Provider([call('invented_tool', {})]))
    assert result['status'] == 'awaiting_clarification' and not backend.calls
    result = await orchestrate(backend, Provider([call('get_context', {})] * 3), max_calls=1)
    assert result['status'] == 'failed' and len(backend.calls) == 1


def test_signed_context_enforces_audience_expiry_and_subject(signing):
    public, token = signing
    assert verify_context(token(), public, 'productivity-v1')['sub'] == 'student-A'
    for invalid in [token(aud='other'), token(exp=1), token(sub=''), token(exp=int(time.time())+1000), 'bad.token.value']:
        with pytest.raises(HTTPException): verify_context(invalid, public, 'productivity-v1')


@pytest.mark.asyncio
async def test_backend_uses_fixed_origin_no_redirects_and_preserves_step_identity(settings):
    requests = []
    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={'result': {'status': 'completed'}})
    backend = AkadverseClient(settings, 'callback-test-token', httpx.MockTransport(handler))
    args = {'input': {'title': 'Read', 'priority': 'low'}}
    await backend.tool(2, 'create_task', args)
    await backend.tool(2, 'create_task', args)
    assert requests[0].url == 'https://akadverse.test/api/productivity/assistant/service'
    assert requests[0].content == requests[1].content
    def redirect(request): return httpx.Response(302, headers={'location': 'https://other.test'})
    with pytest.raises(BackendError): await AkadverseClient(settings, 'test', httpx.MockTransport(redirect)).context()


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', ['unexpected', 'provider503', 'provider403', 'provider400', 'timeout'])
async def test_api_authentication_binding_and_sanitised_provider_failure(settings, signing, monkeypatch, failure, caplog):
    import app.main as main
    monkeypatch.setattr(main, 'get_settings', lambda: settings)
    import app.security as security
    monkeypatch.setattr(security, 'get_settings', lambda: settings)
    monkeypatch.setattr(main, 'AkadverseClient', lambda *_: Backend())
    class Broken:
        async def generate(self, _):
            from google.genai.errors import ServerError, ClientError
            if failure == 'provider503': raise ServerError(503, {'error': {'message': 'private provider credential'}})
            if failure == 'provider403': raise ClientError(403, {'error': {'message': 'private provider credential'}})
            if failure == 'provider400': raise ClientError(400, {'error': {'message': 'private provider credential'}})
            if failure == 'timeout': raise TimeoutError('private provider credential')
            raise RuntimeError('private provider credential')
    monkeypatch.setattr(main, 'GeminiClient', lambda _: Broken())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://service.test') as client:
        assert (await client.get('/health')).json() == {'status': 'ok'}
        payload = {'conversation_id': 'conversation-A', 'turn_id': 'turn-0001', 'callback_token': signing[1]('akadverse-productivity-backend')}
        assert (await client.post('/api/v1/assistant/chat', json=payload)).status_code == 401
        headers = {'Authorization': 'Bearer '+signing[1](), 'X-Productivity-Service-Token': settings.productivity_ai_service_token.get_secret_value()}
        assert (await client.post('/api/v1/assistant/chat', json={**payload, 'conversation_id': 'someone-else'}, headers=headers)).status_code == 403
        result = await client.post('/api/v1/assistant/chat', json=payload, headers=headers)
        assert result.status_code == 200 and result.json()['status'] == 'failed'
        assert 'private provider credential' not in result.text
        assert 'private provider credential' not in caplog.text
        if failure == 'provider503': assert 'temporarily unavailable' in result.json()['message']
        if failure == 'provider403': assert 'provider access' in result.json()['message']
        if failure == 'provider400': assert 'request format' in result.json()['message']
        if failure == 'timeout': assert 'too long' in result.json()['message']
        swapped = {**payload, 'callback_token': signing[1]('akadverse-productivity-backend', sub='student-B')}
        assert (await client.post('/api/v1/assistant/chat', json=swapped, headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_streamed_request_body_limit_is_enforced_before_parsing():
    async def chunks():
        for _ in range(4):
            yield b'x' * 10000
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://service.test') as client:
        result = await client.post('/api/v1/assistant/chat', content=chunks(), headers={'content-type': 'application/json'})
        assert result.status_code == 413
