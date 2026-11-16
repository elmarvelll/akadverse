import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from google.genai import types
from ..tools.registry import validate_call


logger = logging.getLogger(__name__)


@asynccontextmanager
async def phase_timing(reference, phase, step):
    # Only server-defined phase names and counters; never prompts, arguments,
    # results, tokens, or exception text. finally also runs on timeout cancellation.
    started = time.monotonic()
    completed = False
    try:
        yield
        completed = True
    finally:
        log = logger.info if completed else logger.warning
        log('Assistant timing reference_id=%s phase=%s step=%s ms=%s completed=%s',
            reference, phase, step, round((time.monotonic() - started) * 1000), completed)


def initial_contents(context: dict) -> list:
    # Roles in saved messages are not tool authority. Current tool results are separately structured.
    account = json.dumps(context.get('account', {}), ensure_ascii=False)
    messages = context.get('messages', [])[-24:]
    history = [{'role': row['role'], 'content': row['content'][:4000], 'status': row.get('status')}
               for row in messages if row.get('role') in ('user', 'assistant')]
    return [types.Content(role='user', parts=[types.Part.from_text(text=json.dumps({
        'verified_account': json.loads(account),
        'conversation_messages': history,
        'pending_actions': context.get('pending', []),
        'recent_actual_executions': context.get('executions', [])[:10],
        'instruction': 'Respond to the last student message, using current backend facts before any change.'
    }, ensure_ascii=False))])]


async def orchestrate(backend, provider, max_calls: int = 10) -> dict:
    reference = str(uuid.uuid4())
    async with phase_timing(reference, 'backend.context', 0):
        context = await backend.context()
    contents = initial_contents(context)
    step = 0
    results = []
    seen_writes = set()
    read_names = {'get_context', 'list_tasks', 'get_task', 'list_habits', 'habit_occurrences', 'list_schedule', 'official_classes', 'task_analytics', 'schedule_analytics'}
    for _ in range(max_calls + 1):
        async with phase_timing(reference, 'provider.generate', step):
            content = await provider.generate(contents)
        contents.append(content)  # Preserve provider thought signatures on function call parts.
        calls = [part.function_call for part in (content.parts or []) if part.function_call]
        if not calls:
            text = '\n'.join(part.text for part in (content.parts or []) if part.text and not part.thought).strip()
            if not text and results:
                # Let the backend summarize durable executions instead of
                # asking for clarification after an operation already ran.
                return {'message': 'The assistant returned no final reply. Review the saved operation results.', 'status': 'failed'}
            return {'message': text[:8000] or 'Please clarify what you would like to do.',
                    'status': 'completed' if results else 'awaiting_clarification'}
        responses = []
        for call in calls:
            if step >= max_calls:
                return {'message': 'This request reached the operation limit. Review the saved results, then ask for the remaining steps.', 'status': 'failed'}
            name, raw_args = call.name or '', call.args or {}
            try:
                arguments = validate_call(name, raw_args)
            except ValueError:
                return {'message': 'I need more precise information before using that operation. Please include the record and required dates or times.', 'status': 'awaiting_clarification'}
            fingerprint = json.dumps([name, arguments], sort_keys=True)
            if name not in read_names and fingerprint in seen_writes:
                return {'message': 'That change has already been attempted in this message. Review its saved result before asking for another copy.', 'status': 'failed'}
            if name not in read_names:
                seen_writes.add(fingerprint)
            async with phase_timing(reference, 'backend.tool', step):
                result = await backend.tool(step, name, arguments)
            step += 1
            results.append(result)
            status = result.get('status')
            if status == 'awaiting_confirmation':
                return {'message': 'Please review the proposed ' + name.replace('_', ' ') + ' action below. Use Confirm to save it or Cancel to leave it unchanged.', 'status': status}
            if status == 'unknown':
                return {'message': 'The operation outcome is unconfirmed. Use Recheck outcome before repeating the change. Earlier confirmed results remain saved.', 'status': 'failed'}
            if status in ('failed', 'cancelled'):
                error = result.get('error') or {}
                return {'message': 'That operation was not completed. ' + str(error.get('error', 'Review the operation result.'))[:600] + ' Earlier confirmed steps remain saved.', 'status': 'failed'}
            responses.append(types.Part(function_response=types.FunctionResponse(id=call.id, name=name, response=result)))
        # Gemini accepts function responses as user content, not an OpenAI-style tool role.
        contents.append(types.Content(role='user', parts=responses))
    return {'message': 'Please split this request into smaller steps and review the saved results.', 'status': 'failed'}
