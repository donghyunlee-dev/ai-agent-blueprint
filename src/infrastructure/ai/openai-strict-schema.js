const JSON_VALUE_DESCRIPTION = 'Serialize this value as compact JSON text. The application parses it before validating the response.';

export function toOpenAiStrictSchema(schema) {
  if (!schema || typeof schema !== 'object') throw new Error('AI_SCHEMA_INVALID');
  if (Object.keys(schema).length === 0) {
    return { type: 'string', description: JSON_VALUE_DESCRIPTION };
  }
  if (Object.hasOwn(schema, 'const')) {
    const { const: constant, ...rest } = schema;
    const type = rest.type ?? (constant === null ? 'null' : Array.isArray(constant) ? 'array' : typeof constant);
    return toOpenAiStrictSchema({ ...rest, type, enum: [constant] });
  }
  if (schema.oneOf) throw new Error('AI_SCHEMA_UNSUPPORTED_COMPOSITION');

  const result = { ...schema };
  if (schema.type === 'object') {
    if (schema.additionalProperties !== false) throw new Error('AI_SCHEMA_OPEN_OBJECT_UNSUPPORTED');
    const properties = {};
    const originallyRequired = new Set(schema.required ?? []);
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
      const converted = toOpenAiStrictSchema(value);
      properties[key] = originallyRequired.has(key)
        ? converted
        : { anyOf: [converted, { type: 'null' }] };
    }
    result.properties = properties;
    result.required = Object.keys(properties);
    result.additionalProperties = false;
    return result;
  }
  if (schema.type === 'array' && schema.items) result.items = toOpenAiStrictSchema(schema.items);
  if (schema.anyOf) result.anyOf = schema.anyOf.map(toOpenAiStrictSchema);
  return result;
}

export function decodeOpenAiStrictOutput(value, schema) {
  if (!schema || typeof schema !== 'object') throw new Error('AI_SCHEMA_INVALID');
  if (Object.keys(schema).length === 0) {
    if (typeof value !== 'string') throw new Error('AI_JSON_VALUE_INVALID');
    return JSON.parse(value);
  }
  if (schema.oneOf) {
    const matching = schema.oneOf.filter((choice) => matchesSchema(value, choice));
    if (matching.length !== 1) throw new Error('AI_SCHEMA_OUTPUT_INVALID');
    return decodeOpenAiStrictOutput(value, matching[0]);
  }
  if (schema.anyOf) {
    const matching = schema.anyOf.filter((choice) => matchesSchema(value, choice));
    if (matching.length !== 1) throw new Error('AI_SCHEMA_OUTPUT_INVALID');
    return decodeOpenAiStrictOutput(value, matching[0]);
  }
  if (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const decoded = { ...value };
    const originallyRequired = new Set(schema.required ?? []);
    for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (!originallyRequired.has(key) && decoded[key] === null) {
        delete decoded[key];
      } else if (Object.hasOwn(decoded, key)) {
        decoded[key] = decodeOpenAiStrictOutput(decoded[key], propertySchema);
      }
    }
    return decoded;
  }
  if (schema.type === 'array' && Array.isArray(value)) {
    return value.map((entry) => decodeOpenAiStrictOutput(entry, schema.items));
  }
  return value;
}

function matchesSchema(value, schema) {
  if (schema?.type === 'null') return value === null;
  if (schema?.const !== undefined) return value === schema.const;
  if (Array.isArray(schema?.enum)) return schema.enum.includes(value);
  if (schema?.type === 'object') return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  if (schema?.type === 'array') return Array.isArray(value);
  if (schema?.type === 'string') return typeof value === 'string';
  if (schema?.type === 'number' || schema?.type === 'integer') return typeof value === 'number';
  if (schema?.type === 'boolean') return typeof value === 'boolean';
  return false;
}
