import definitions from "../../../akadverse-productivity-ai/app/tools/definitions.json";
import { badRequest } from "@/lib/service-error";
// The same allowlist/schema ships with Python; independent backend validation is mandatory.
type Schema = { type?: string; enum?: unknown[]; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean; items?: Schema; minLength?: number; maxLength?: number; minimum?: number; maximum?: number; maxItems?: number; uniqueItems?: boolean; pattern?: string };
export const toolDefinitions = definitions;
export function validateTool(name: string, args: unknown): Record<string, unknown> {
  const definition = definitions.find(item => item.name === name);
  if (!definition) throw badRequest("This assistant tool is not supported.");
  validate(definition.parameters as unknown as Schema, args, "arguments");
  return args as Record<string, unknown>;
}
function validate(schema: Schema, value: unknown, path: string) {
  const fail = () => { throw badRequest(`Invalid tool ${path}.`); };
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).some(key => !Object.prototype.hasOwnProperty.call(schema.properties, key)) || schema.required?.some(key => !(key in obj))) return fail();
    for (const [key, item] of Object.entries(obj)) validate(schema.properties![key], item, `${path}.${key}`);
  } else if (schema.type === "array") {
    if (!Array.isArray(value) || schema.maxItems !== undefined && value.length > schema.maxItems || schema.uniqueItems && new Set(value).size !== value.length) return fail();
    for (const item of value) validate(schema.items!, item, path);
  } else if (schema.type === "string") {
    if (typeof value !== "string" || value.length > (schema.maxLength ?? 200) || value.length < (schema.minLength ?? 0) || schema.pattern && !new RegExp(schema.pattern).test(value)) return fail();
  } else if (schema.type === "boolean" && typeof value !== "boolean") return fail();
  else if (schema.type === "integer" && (typeof value !== "number" || !Number.isInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) return fail();
  if (schema.enum && !schema.enum.includes(value)) fail();
}
