from functools import lru_cache
from urllib.parse import urlparse
from pydantic import field_validator, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    gemini_api_key: SecretStr
    gemini_model: str = 'gemini-3.5-flash-lite'
    akadverse_api_base_url: str
    productivity_ai_service_token: SecretStr
    productivity_ai_jwt_public_key: str
    productivity_ai_jwt_key_id: str = 'productivity-v1'
    max_tool_calls: int = 10
    turn_timeout_seconds: int = 55

    @field_validator('akadverse_api_base_url')
    @classmethod
    def fixed_origin(cls, value: str) -> str:
        url = urlparse(value)
        if (url.username or url.password or url.query or url.fragment or url.path not in ('', '/')
                or not url.hostname or url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1'))):
            raise ValueError('Use a canonical HTTPS origin, or HTTP loopback in development')
        return value.rstrip('/')

    @field_validator('max_tool_calls')
    @classmethod
    def bounded_calls(cls, value: int) -> int:
        if not 1 <= value <= 10:
            raise ValueError('Tool calls must be between 1 and 10')
        return value

    @field_validator('turn_timeout_seconds')
    @classmethod
    def bounded_timeout(cls, value: int) -> int:
        if not 5 <= value <= 55:
            raise ValueError('Turn timeout must be between 5 and 55 seconds')
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
