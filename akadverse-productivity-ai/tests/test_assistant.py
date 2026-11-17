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


class ManagedStub:
    async def __aenter__(self): return self
    async def __aexit__(self, *exc): pass


class Provider(ManagedStub):
    def __init__(self, responses):
        self.responses = iter(responses)
        self.requests = []

    async def generate(self, contents):
        self.requests.append(list(contents))
        return next(self.responses)


class Backend(ManagedStub):
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
    class Broken(ManagedStub):
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


@pytest.mark.asyncio
async def test_backend_database_failure_preserves_only_safe_metadata_and_never_retries(settings):
    count = 0
    reference = 'c116e351-e6c1-4e22-8785-1ac44ee73bd5'
    def handler(request):
        nonlocal count
        count += 1
        return httpx.Response(503, json={'code': 'DATABASE_UNAVAILABLE', 'referenceId': reference,
                                        'error': 'postgresql://private-credential@example.test/private-data'})
    backend = AkadverseClient(settings, 'private-callback-token', httpx.MockTransport(handler))
    with pytest.raises(BackendError) as failure:
        await backend.tool(0, 'create_task', {'input': {'title': 'Read', 'priority': 'low'}})
    error = failure.value
    assert error.status == 503 and error.code == 'DATABASE_UNAVAILABLE' and error.action == 'tool'
    assert error.reference_id == reference and reference in error.public_message
    assert 'database is temporarily unreachable' in error.public_message
    assert 'private' not in str(error) + error.public_message
    assert count == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('status,payload,expected', [
    (503, {'code': 'DATABASE_TIMEOUT', 'referenceId': 'unsafe-private-credential'}, 'DATABASE_TIMEOUT'),
    (503, {'code': 'private-credential', 'referenceId': 'private-credential'}, 'BACKEND_HTTP_ERROR'),
    (200, {'result': None}, 'BACKEND_INVALID_RESPONSE'),
])
async def test_backend_rejects_unsafe_metadata_and_invalid_result(settings, status, payload, expected):
    backend = AkadverseClient(settings, 'token', httpx.MockTransport(lambda _: httpx.Response(status, json=payload)))
    with pytest.raises(BackendError) as failure:
        await backend.context()
    assert failure.value.code == expected and failure.value.reference_id is None
    assert 'private-credential' not in failure.value.public_message


@pytest.mark.asyncio
async def test_backend_timeout_is_not_a_provider_error_and_is_not_retried(settings):
    calls = 0
    def handler(request):
        nonlocal calls
        calls += 1
        raise httpx.ReadTimeout('private-url-and-token', request=request)
    with pytest.raises(BackendError) as failure:
        await AkadverseClient(settings, 'token', httpx.MockTransport(handler)).context()
    assert failure.value.code == 'BACKEND_TIMEOUT' and calls == 1
    assert 'private-url' not in failure.value.public_message


@pytest.mark.asyncio
async def test_chat_reports_backend_database_reference_without_calling_gemini(settings, signing, monkeypatch, caplog):
    import app.main as main
    import app.security as security
    reference = 'c116e351-e6c1-4e22-8785-1ac44ee73bd5'
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(503, json={'code': 'DATABASE_UNAVAILABLE', 'referenceId': reference,
                                        'error': 'private database URL and password'})
    monkeypatch.setattr(main, 'get_settings', lambda: settings)
    monkeypatch.setattr(security, 'get_settings', lambda: settings)
    monkeypatch.setattr(main, 'AkadverseClient', lambda _, token: AkadverseClient(settings, token, httpx.MockTransport(handler)))
    monkeypatch.setattr(main, 'GeminiClient', lambda _: Provider([]))  # Would fail if generate() were called.
    headers = {'Authorization': 'Bearer ' + signing[1](), 'X-Productivity-Service-Token': settings.productivity_ai_service_token.get_secret_value()}
    payload = {'conversation_id': 'conversation-A', 'turn_id': 'turn-0001', 'callback_token': signing[1]('akadverse-productivity-backend')}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://service.test') as client:
        response = await client.post('/api/v1/assistant/chat', json=payload, headers=headers)
    assert response.status_code == 200 and response.json()['status'] == 'failed'
    assert 'database is temporarily unreachable' in response.json()['message']
    assert reference in response.json()['message'] and reference in caplog.text
    assert 'category=backend action=context status=503 code=DATABASE_UNAVAILABLE' in caplog.text
    assert 'private database' not in response.text + caplog.text
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_timeout_cancellation_identifies_active_phase_without_private_data(caplog):
    import asyncio
    import logging
    caplog.set_level(logging.INFO, logger='uvicorn.error.assistant')

    class SlowProvider:
        async def generate(self, contents):
            await asyncio.Event().wait()

    with pytest.raises(TimeoutError):
        async with asyncio.timeout(0.02):
            await orchestrate(Backend(), SlowProvider())
    assert 'phase=backend.context step=0' in caplog.text
    assert 'phase=provider.generate step=0' in caplog.text
    assert 'completed=False' in caplog.text
    assert 'Create my task' not in caplog.text


@pytest.mark.asyncio
async def test_backend_timeout_identifies_tool_phase(caplog):
    class SlowBackend(Backend):
        async def tool(self, step, name, args):
            raise BackendError(code='BACKEND_TIMEOUT', action='tool')

    with pytest.raises(BackendError):
        await orchestrate(SlowBackend(), Provider([call('create_task', {'input': {'title': 'private-title', 'priority': 'low'}})]))
    assert 'phase=backend.tool step=0' in caplog.text
    assert 'completed=False' in caplog.text
    assert 'private-title' not in caplog.text


@pytest.mark.asyncio
async def test_empty_final_reply_after_tool_requests_durable_backend_summary():
    backend = Backend()
    result = await orchestrate(backend, Provider([
        call('create_task', {'input': {'title': 'Read', 'priority': 'low'}}),
        answer(''),
    ]))
    assert result['status'] == 'failed'
    assert 'saved operation results' in result['message']
    assert 'clarify' not in result['message']
    assert len(backend.calls) == 1


@pytest.mark.parametrize('name,args', [
    ('list_buddies', {'view': 'groups', 'search': 'Biology', 'page': 1}),
    ('get_buddy', {'listing_id': 'listing-1'}),
    ('create_buddy_group', {'title': 'Biology', 'description': 'Weekly study', 'invitation_url': 'https://t.me/+abcdef123', 'max_members': 5}),
    ('create_buddy_request', {'title': 'Biology buddy', 'description': 'Study together', 'contact_details': 'Contact supplied by student'}),
    ('apply_buddy', {'listing_id': 'listing-1'}),
    ('accept_buddy_application', {'listing_id': 'listing-1', 'application_id': 'application-1'}),
    ('decline_buddy_application', {'listing_id': 'listing-1', 'application_id': 'application-1'}),
    ('close_buddy_listing', {'listing_id': 'listing-1'}),
])
def test_buddy_tools_reject_identity_injection(name, args):
    assert validate_call(name, args) == args
    with pytest.raises(ValueError):
        validate_call(name, {**args, 'userId': 'someone-else'})


@pytest.mark.parametrize('name,args', [
    ('create_buddy_group', {'title': 'Group', 'description': 'Study'}),
    ('create_buddy_request', {'title': 'Request', 'description': 'Study'}),
    ('list_buddies', {'view': 'all-private-data'}),
    ('list_buddies', {'page': 0}),
    ('accept_buddy_application', {'listing_id': 'listing-1'}),
])
def test_buddy_tools_require_explicit_fields(name, args):
    with pytest.raises(ValueError):
        validate_call(name, args)


async def test_buddy_reads_can_repeat_and_confirmation_stops_followup_changes():
    backend = Backend(results=[{'status': 'completed', 'result': {'items': []}}] * 2 + [{'status': 'awaiting_confirmation'}])
    provider = Provider([
        call('list_buddies', {'view': 'groups'}),
        call('list_buddies', {'view': 'groups'}),
        types.Content(role='model', parts=[
            types.Part.from_function_call(name='apply_buddy', args={'listing_id': 'listing-1'}),
            types.Part.from_function_call(name='close_buddy_listing', args={'listing_id': 'listing-2'}),
        ]),
    ])
    result = await orchestrate(backend, provider)
    assert result['status'] == 'awaiting_confirmation'
    assert [name for _, name, _ in backend.calls] == ['list_buddies', 'list_buddies', 'apply_buddy']


async def test_backend_reuses_one_client_per_turn_and_releases_it(settings, monkeypatch):
    import app.integrations.akadverse as integration
    original = httpx.AsyncClient
    clients = []
    def factory(*args, **kwargs):
        client = original(*args, **kwargs)
        clients.append(client)
        return client
    monkeypatch.setattr(integration.httpx, 'AsyncClient', factory)
    seen_tokens = []
    def handler(request):
        seen_tokens.append(request.headers['Authorization'])
        return httpx.Response(200, json={'result': {'status': 'completed'}})
    async with AkadverseClient(settings, 'turn-A', httpx.MockTransport(handler)) as backend:
        await backend.context()
        await backend.tool(0, 'list_tasks', {})
        await backend.tool(1, 'get_task', {'task_id': 'task-1'})
        assert len(clients) == 1 and not clients[0].is_closed
    assert clients[0].is_closed
    async with AkadverseClient(settings, 'turn-B', httpx.MockTransport(handler)) as backend:
        await backend.context()
    assert len(clients) == 2 and clients[1].is_closed
    assert seen_tokens == ['Bearer turn-A'] * 3 + ['Bearer turn-B']


async def test_backend_closes_connection_on_cancelled_turn(settings):
    import asyncio
    async def handler(request):
        await asyncio.Event().wait()
    backend = AkadverseClient(settings, 'token', httpx.MockTransport(handler))
    with pytest.raises(TimeoutError):
        async with asyncio.timeout(0.02), backend:
            await backend.context()
    assert backend._client is None


async def test_gemini_reuses_session_without_changing_model_tools_or_quality(settings, monkeypatch):
    from types import SimpleNamespace
    import app.integrations.gemini as integration
    from app.integrations.gemini import GeminiClient
    sessions = []
    requests = []
    class Session:
        def __init__(self): self.models = self; self.closed = False
        async def __aenter__(self): return self
        async def __aexit__(self, *exc): self.closed = True
        async def generate_content(self, **kwargs):
            requests.append(kwargs)
            return SimpleNamespace(candidates=[SimpleNamespace(content=answer('Done'))])
    def factory(**kwargs):
        session = Session(); sessions.append(session)
        return SimpleNamespace(aio=session)
    monkeypatch.setattr(integration.genai, 'Client', factory)
    async with GeminiClient(settings) as provider:
        await provider.generate([answer('First')])
        await provider.generate([answer('Second')])
        assert len(sessions) == 1 and not sessions[0].closed
    assert sessions[0].closed
    assert len(requests) == 2
    for request in requests:
        assert request['model'] == settings.gemini_model
        assert request['config'].max_output_tokens == 2048
        assert request['config'].thinking_config.thinking_level.value.lower() == 'low'
        assert len(request['config'].tools[0].function_declarations) == len(DEFINITIONS)
        assert request['config'].automatic_function_calling.disable is True
