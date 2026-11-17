import json
from pathlib import Path
from jsonschema import Draft202012Validator, ValidationError

DEFINITIONS = json.loads(Path(__file__).with_name('definitions.json').read_text())
REGISTRY = {item['name']: item for item in DEFINITIONS}
VALIDATORS = {name: Draft202012Validator(item['parameters']) for name, item in REGISTRY.items()}


def validate_call(name: str, arguments: object) -> dict:
    if name not in REGISTRY:
        raise ValueError('Unsupported assistant tool')
    try:
        VALIDATORS[name].validate(arguments)
    except ValidationError:
        raise ValueError('Tool arguments failed validation; ask for the missing or corrected information') from None
    return arguments
