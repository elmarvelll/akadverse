from functools import lru_cache
from google import genai
from google.genai import types
from ..config import Settings
from ..tools.registry import DEFINITIONS
from ..agent.prompts import SYSTEM_PROMPT


def provider_schema(value):
    # Use Gemini's portable function-schema subset; both executors enforce full constraints.
    if isinstance(value, dict):
        return {key: provider_schema(item) for key, item in value.items() if key not in {'uniqueItems', 'additionalProperties', 'maxLength', 'minLength', 'pattern', 'minimum', 'maximum', 'maxItems'}}
    if isinstance(value, list):
        return [provider_schema(item) for item in value]
    return value


@lru_cache(maxsize=1)
def declarations():
    return [types.FunctionDeclaration(**provider_schema(item)) for item in DEFINITIONS]


class GeminiClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client = None

    async def __aenter__(self):
        self._client = genai.Client(
            api_key=self.settings.gemini_api_key.get_secret_value(),
            http_options=types.HttpOptions(timeout=40000, retry_options=types.HttpRetryOptions(attempts=1)),
        ).aio
        await self._client.__aenter__()
        return self

    async def __aexit__(self, *exc):
        client, self._client = self._client, None
        if client is not None:
            await client.__aexit__(*exc)

    async def generate(self, contents: list):
        if self._client is None:
            async with self:
                return await self.generate(contents)
        # One request-scoped client reuses connections across the validated tool loop.
        response = await self._client.models.generate_content(
            model=self.settings.gemini_model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                tools=[types.Tool(function_declarations=declarations())],
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                max_output_tokens=2048,
                thinking_config=types.ThinkingConfig(thinking_level="low"),
            ),
        )
        if not response.candidates or not response.candidates[0].content:
            raise ValueError('Provider returned no usable content')
        return response.candidates[0].content
